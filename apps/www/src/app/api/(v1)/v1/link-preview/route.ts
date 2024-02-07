import { request } from "@chia/utils";
import { withRateLimiter, createClient } from "@chia/cache";
import * as Sentry from "@sentry/nextjs";
import { errorGenerator, isUrl, handleZodError } from "@chia/utils";
import { NextResponse } from "next/server";
import { JSDOM } from "jsdom";
import { type DocResponse, type PreviewDTO, previewSchema } from "./_utils";
import { type NextRequest } from "next/server";
import { HTTPError } from "ky";

export const runtime = "nodejs";

export const POST = withRateLimiter<
  NextResponse,
  Error | HTTPError,
  NextRequest
>(
  async (req) => {
    try {
      const { href } = (await req.json()) as PreviewDTO;

      const { isError, issues } = handleZodError({
        schema: previewSchema,
        data: { href },
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

      const res = await request({
        headers: { "Content-Type": "text/html" },
      }).get(href);
      const html = await res.text();
      const parsed = new JSDOM(html);

      const title = parsed.window.document.querySelector("title")?.textContent;
      const description = parsed.window.document
        .querySelector('meta[name="description"]')
        ?.getAttribute("content");
      const favicon = parsed.window.document
        .querySelector('link[rel="icon"]')
        ?.getAttribute("href");
      const ogImage = parsed.window.document
        .querySelector('meta[property="og:image"]')
        ?.getAttribute("content");

      return NextResponse.json<DocResponse>({
        title,
        description,
        favicon,
        ogImage,
      });
    } catch (error) {
      console.error(error);
      if (error instanceof HTTPError) {
        return NextResponse.json(errorGenerator(error.response.status as any), {
          status: error.response.status,
        });
      }
      Sentry.captureException(error);
      return NextResponse.json(errorGenerator(500), {
        status: 500,
      });
    }
  },
  {
    client: createClient(),
    onError: (error) => {
      console.error("Rate Limiter: ", error);
      Sentry.captureException(error);
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
