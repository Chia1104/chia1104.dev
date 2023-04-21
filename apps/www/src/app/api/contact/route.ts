import sendgrid from "@sendgrid/mail";
import { Chia } from "@/shared/meta/chia";
import { NextResponse, NextRequest } from "next/server";
import { ApiResponseStatus } from "@/utils/fetcher.util";
import { errorConfig } from "@/config/network.config";
import { z } from "zod";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.REDIS_URL ?? "",
  token: process.env.UPSTASH_TOKEN ?? "",
});

sendgrid.setApiKey(process.env.SENDGRID_KEY ?? "");

const ratelimit = new Ratelimit({
  redis,
  analytics: true,
  limiter: Ratelimit.slidingWindow(2, "5s"),
});

const EmailSchema = z.string().email();

const contactSchema = z.object({
  email: EmailSchema,
  message: z.string().min(1),
  reCaptchToken: z.string().min(1),
});

type Email = z.infer<typeof EmailSchema>;

type ReCapthcaResponse = {
  success: boolean;
  challenge_ts: string;
  hostname: string;
  "error-codes": string[];
};

export async function POST(request: NextRequest) {
  try {
    const id = request.ip ?? "anonymous";
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
    const reCaptchToken = formData.get("g-recaptcha-response")?.toString();

    if (!contactSchema.safeParse({ email, message, reCaptchToken }).success) {
      return NextResponse.json(
        {
          statusCode: 400,
          status: ApiResponseStatus.ERROR,
          message: errorConfig[400],
        },
        { status: 400 }
      );
    }

    const siteverify = await fetch(
      `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RE_CAPTCHA_KEY}&response=${reCaptchToken}&remoteip=${id}`,
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
          message: errorConfig[400],
        },
        { status: 400 }
      );
    }

    const msg = {
      to: Chia.email,
      from: Chia.email,
      subject: `Message from ${email} via chia1104.dev`,
      text: message as string,
    };
    const sendgridRes = await sendgrid.send(msg);
    if (sendgridRes[0].statusCode === 202) {
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
    }
    return NextResponse.json(
      {
        statusCode: 400,
        status: ApiResponseStatus.ERROR,
        message: errorConfig[400],
      },
      { status: 400 }
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
