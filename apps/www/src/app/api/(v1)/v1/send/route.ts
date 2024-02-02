import meta from "@chia/meta";
import { NextResponse, NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { setSearchParams, handleZodError } from "@chia/utils";
import { Resend } from "resend";
import { errorGenerator } from "@chia/utils";
import { env } from "@/env.mjs";
import { contactSchema, type Contact } from "@/shared/validator";
import * as Sentry from "@sentry/nextjs";
import EmailTemplate from "./email-template";
import { kv } from "@vercel/kv";

export const runtime = "edge";
/**
 * Hong Kong
 */
export const preferredRegion = ["hnd1"];

const resend = new Resend(env.RESEND_API_KEY);

const redis = new Redis({
  url: env.REDIS_URL!,
  token: env.UPSTASH_TOKEN!,
});

const ratelimit = new Ratelimit({
  redis: process.env.VERCEL ? kv : redis,
  analytics: true,
  timeout: 1000,
  limiter: Ratelimit.slidingWindow(2, "5s"),
  prefix: "rate-limiter",
});

type ReCapthcaResponse = {
  success: boolean;
  challenge_ts: string;
  hostname: string;
  "error-codes": string[];
};

function getIP(req: NextRequest) {
  try {
    let ip = req.ip ?? req.headers.get("x-real-ip");
    const forwardedFor = req.headers.get("x-forwarded-for");

    if (!ip && forwardedFor) {
      ip = forwardedFor.split(",").at(0) ?? "";
    }

    return ip;
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const id = getIP(request) ?? "anonymous";
    const { success, limit, reset, remaining } = await ratelimit.limit(
      id,
      request
    );

    if (!success) {
      return NextResponse.json(errorGenerator(429), {
        status: 429,
        headers: {
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": reset.toString(),
        },
      });
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
        secret: env.RE_CAPTCHA_KEY,
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
    const result = await resend.emails.send({
      from: "contact@chia1104.dev",
      to: meta.email,
      subject: data.title ?? "Untitled",
      text: data.message ?? "No message",
      react: EmailTemplate({
        title: data.title ?? "Untitled",
        message: data.message ?? "No message",
        email: data.email ?? "Anonymous",
        ip: id,
      }),
    });
    if (result.error) {
      console.error(result.error.message);
      Sentry.captureException(result.error);
      return NextResponse.json(
        errorGenerator(500, [
          {
            field: "email",
            message: "Failed to send email",
          },
        ]),
        {
          status: 500,
        }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(error);
    Sentry.captureException(error);
    return NextResponse.json(errorGenerator(500), {
      status: 500,
    });
  }
}
