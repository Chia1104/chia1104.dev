import { Chia } from "@/shared/meta/chia";
import { NextResponse, NextRequest } from "next/server";
import { ApiResponseStatus } from "@/utils/fetcher.util";
import { errorConfig } from "@/config/network.config";
import { z } from "zod";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import EmailTemplate from "./email-template";
import { setSearchParams, handleZodError } from "@chia/utils";
import { Resend } from "resend";

export const runtime = "nodejs";

const resend = new Resend(process.env.RESEND_API_KEY);

const redis = new Redis({
  url: process.env.REDIS_URL ?? "",
  token: process.env.UPSTASH_TOKEN ?? "",
});

const ratelimit = new Ratelimit({
  redis,
  analytics: true,
  limiter: Ratelimit.slidingWindow(2, "5s"),
});

const emailSchema = z.string().email();

const contactSchema = z.object({
  email: z.string().email(),
  title: z.string().min(5, "Title must be at least 5 characters long"),
  message: z.string().min(5, "Message must be at least 5 characters long"),
  reCaptchToken: z.string().min(1, "reCAPTCHA token is required"),
});

type Email = z.infer<typeof emailSchema>;

type ReCapthcaResponse = {
  success: boolean;
  challenge_ts: string;
  hostname: string;
  "error-codes": string[];
};

function getIP(req: NextRequest) {
  let ip = req.ip ?? req.headers.get("x-real-ip");
  const forwardedFor = req.headers.get("x-forwarded-for");

  if (!ip && forwardedFor) {
    ip = forwardedFor.split(",").at(0) ?? "";
  }

  return ip;
}

export async function POST(request: NextRequest) {
  try {
    const id = getIP(request) ?? "anonymous";
    const limit = await ratelimit.limit(id ?? "anonymous");

    if (!limit.success) {
      return NextResponse.json(
        {
          statusCode: 429,
          status: ApiResponseStatus.ERROR,
          message: errorConfig[429],
        },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const email = formData.get("email")?.toString();
    const message = formData.get("message")?.toString();
    const title = formData.get("title")?.toString();
    const reCaptchToken = formData.get("g-recaptcha-response")?.toString();

    const {
      isError,
      message: errorMessage,
      issues,
    } = handleZodError({
      schema: contactSchema,
      data: { title, email, message, reCaptchToken },
    });

    if (isError) {
      const wtfNextServerRuntime = issues
        ?.map((issue) => issue.message)
        .join(", ");
      return NextResponse.json(
        {
          statusCode: 400,
          status: ApiResponseStatus.ERROR,
          message: wtfNextServerRuntime,
        },
        { status: 400 }
      );
    }

    const siteverify = await fetch(
      `https://www.google.com/recaptcha/api/siteverify?${setSearchParams({
        secret: process.env.RE_CAPTCHA_KEY,
        response: reCaptchToken,
        remoteip: id,
      })}`,
      {
        method: "POST",
      }
    );
    const siteverifyJson = (await siteverify.json()) as ReCapthcaResponse;
    if (!siteverifyJson.success) {
      return NextResponse.json(
        {
          statusCode: 400,
          status: ApiResponseStatus.ERROR,
          message: "reCAPTCHA verification failed.",
        },
        { status: 400 }
      );
    }
    const data = await resend.emails.send({
      from: "contact@chia1104.dev",
      to: Chia.email,
      subject: title ?? "Untitled",
      text: message ?? "No message",
      react: EmailTemplate({
        title: title,
        message: message,
        email: email,
        ip: id,
      }),
    });
    return NextResponse.json(
      {
        statusCode: 200,
        status: ApiResponseStatus.SUCCESS,
        data: {
          message: "We have received your message.",
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      {
        statusCode: error?.code ?? 500,
        status: ApiResponseStatus.ERROR,
        message: !!error?.code
          ? "Sorry, something went wrong. Please try again later."
          : errorConfig[500],
      },
      { status: error?.code ?? 500 }
    );
  }
}
