import { captureException } from "@sentry/nextjs";
import { NextResponse, after } from "next/server";
import { Resend } from "resend";

import { createUpstash } from "@chia/cache/create-upstash";
import { withRateLimiter } from "@chia/cache/with-rate-limiter";
import meta from "@chia/meta";
import { setSearchParams, handleZodError } from "@chia/utils";
import { errorGenerator, CONTACT_EMAIL } from "@chia/utils";

import { env } from "@/env";
import { contactSchema } from "@/shared/validator";
import type { Contact } from "@/shared/validator";

import EmailTemplate from "./email-template";

export const runtime = "nodejs";
/**
 * Tokyo, Japan
 */
export const preferredRegion = ["hnd1"];

const resend = new Resend(env.RESEND_API_KEY);

interface ReCapthcaResponse {
  success: boolean;
  challenge_ts: string;
  hostname: string;
  "error-codes": string[];
}

export const POST = withRateLimiter(
  async (request, response, id) => {
    try {
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
        setSearchParams(
          {
            secret: env.RE_CAPTCHA_KEY,
            response: data.reCaptchToken,
            remoteip: id,
          },
          {
            baseUrl: "https://www.google.com/recaptcha/api/siteverify",
          }
        ),
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
        from: CONTACT_EMAIL,
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
        captureException(result.error);
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
      after(() => {
        captureException(error);
      });
      return NextResponse.json(errorGenerator(500), {
        status: 500,
      });
    }
  },
  {
    client: createUpstash(),
    onError: (error) => {
      console.error(error);
      after(() => {
        captureException(error);
      });
      return NextResponse.json(errorGenerator(500), {
        status: 500,
      });
    },
    onLimitReached: ({ limit, remaining, reset }) => {
      return NextResponse.json(errorGenerator(429), {
        status: 429,
        headers: {
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": reset.toString(),
        },
      });
    },
  }
);
