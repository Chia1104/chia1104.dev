import { request } from "@chia/utils";
import { withRateLimiter, createClient, Upstash } from "@chia/cache";
import * as Sentry from "@sentry/nextjs";
import { errorGenerator, isUrl, handleZodError } from "@chia/utils";
import { NextResponse } from "next/server";
import { JSDOM } from "jsdom";
import { type DocResponse, type PreviewDTO } from "./_utils";
import { type NextRequest } from "next/server";
import { HTTPError } from "ky";
import { z } from "zod";

const previewSchema = z.strictObject({
  href: z.string().min(1),
});

export const runtime = "nodejs";
/**
 * Tokyo, Japan
 */
export const preferredRegion = ["hnd1"];

export const POST = withRateLimiter<
  NextResponse,
  Error | HTTPError,
  NextRequest
>(
  async (req) => {
    try {
      let dto: PreviewDTO | null = null;
      await (req.json() as Promise<PreviewDTO>)
        .then((response) => {
          dto = response;
        })
        .catch(() => {
          dto = null;
        });

      const { isError, issues } = handleZodError({
        schema: previewSchema.refine((data) => isUrl(data.href), {
          message: "Invalid URL",
          path: ["href"],
        }),
        data: dto,
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

      const url = new URL(dto!.href);

      const upstash = new Upstash<DocResponse>({
        prefix: "link-preview",
      });

      const cachedDoc = await upstash.get(dto!.href);

      if (!cachedDoc) {
        const res = await request({
          headers: {
            "Content-Type": "text/html",
          },
        }).get(dto!.href);
        const html = await res.text();
        const parsed = new JSDOM(html);
        const title =
          parsed.window.document.querySelector("title")?.textContent;
        const description = parsed.window.document
          .querySelector('meta[name="description"]')
          ?.getAttribute("content");

        const postparsedFavicon = parsed.window.document
          .querySelector('link[rel="icon"]')
          ?.getAttribute("href");

        const postparsedOgImage = parsed.window.document
          .querySelector('meta[property="og:image"]')
          ?.getAttribute("content");

        const favicon = postparsedFavicon
          ? isUrl(postparsedFavicon)
            ? postparsedFavicon
            : url.origin + "/" + postparsedFavicon.replace(/^\//, "") // remove leading slash
          : undefined;
        const ogImage = postparsedOgImage
          ? isUrl(postparsedOgImage)
            ? postparsedOgImage
            : url.origin + "/" + postparsedOgImage.replace(/^\//, "") // remove leading slash
          : undefined;
        await upstash.set(
          dto!.href,
          {
            title,
            description,
            favicon,
            ogImage,
          },
          {
            ex: 60 * 60 * 24, // remove after 24 hours
          }
        );
        return NextResponse.json<DocResponse>({
          title,
          description,
          favicon,
          ogImage,
        });
      }

      return NextResponse.json<DocResponse>({
        title: cachedDoc.title,
        description: cachedDoc.description,
        favicon: cachedDoc.favicon,
        ogImage: cachedDoc.ogImage,
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
