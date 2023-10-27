import { Chia } from "@/shared/meta/chia";
import { NextResponse, NextRequest } from "next/server";
import { errorConfig } from "@/config/network.config";
import z from "zod";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
// import EmailTemplate from "./email-template";
import { setSearchParams, handleZodError } from "@chia/utils";
import { Resend } from "resend";
import { type ErrorResponse } from "@chia/utils";

/**
 * @todo just let build successfully
 */
export const runtime = "edge";

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

export const contactSchema = z.strictObject({
  email: z.string().email(),
  title: z.string().min(5, "Title must be at least 5 characters long"),
  message: z.string().min(5, "Message must be at least 5 characters long"),
  reCaptchToken: z.string().min(1, "reCAPTCHA token is required"),
});

export type Contact = z.infer<typeof contactSchema>;

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

function errorGenerator(
  statusCode: keyof typeof errorConfig,
  errors?: ErrorResponse["errors"]
): ErrorResponse {
  if (!(statusCode in errorConfig)) {
    return {
      code: "Unknown",
      status: statusCode,
      errors,
    };
  }
  return {
    code: errorConfig[statusCode] ?? "Unknown",
    status: statusCode,
    errors,
  };
}

export async function POST(request: NextRequest) {
  try {
    const id = getIP(request) ?? "anonymous";
    const limit = await ratelimit.limit(id ?? "anonymous");

    if (!limit.success) {
      return NextResponse.json(errorGenerator(429), { status: 429 });
    }

    const data = (await request.json()) as Contact;

    const { isError, issues } = handleZodError({
      schema: contactSchema,
      data,
    });

    if (isError) {
      return NextResponse.json(
        errorGenerator(
          400,
          issues?.map((issue) => {
            return {
              field: issue.path.join("."),
              message: issue.message,
            };
          })
        ),
        { status: 400 }
      );
    }

    const siteverify = await fetch(
      `https://www.google.com/recaptcha/api/siteverify?${setSearchParams({
        secret: process.env.RE_CAPTCHA_KEY,
        response: data.reCaptchToken,
        remoteip: id,
      })}`,
      {
        method: "POST",
      }
    );
    const siteverifyJson = (await siteverify.json()) as ReCapthcaResponse;
    if (!siteverifyJson.success) {
      return NextResponse.json(
        errorGenerator(400, [
          {
            field: "reCaptchToken",
            message: "reCAPTCHA token is invalid",
          },
        ]),
        { status: 400 }
      );
    }
    await resend.emails.send({
      from: "contact@chia1104.dev",
      to: Chia.email,
      subject: data.title ?? "Untitled",
      text: data.message ?? "No message",
      // react: EmailTemplate({
      //   title: data.title ?? "Untitled",
      //   message: data.message ?? "No message",
      //   email: data.email ?? "Anonymous",
      //   ip: id,
      // }),
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json(errorGenerator(error?.code ?? 500), {
      status: error?.code ?? 500,
    });
  }
}
