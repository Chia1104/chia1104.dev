import { captureException } from "@sentry/nextjs";
import { JSDOM } from "jsdom";
import { HTTPError } from "ky";
import { NextResponse, after } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { client } from "@chia/kv/upstash";
import { withRateLimiter } from "@chia/kv/upstash/with-rate-limiter";
import { request } from "@chia/utils";
import { errorGenerator, isUrl, enhanceHandleZodError } from "@chia/utils";

import type { DocResponse, PreviewDTO } from "./_utils";

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

      const result = enhanceHandleZodError({
        schema: previewSchema.refine((data) => isUrl(data.href), {
          message: "Invalid URL",
          path: ["href"],
        }),
        data: dto,
        onFormat: (data) => data?.href ?? "",
      });

      if (result.isError) {
        return NextResponse.json(
          errorGenerator(
            400,
            result.issues.map((issue) => {
              return {
                field: issue.path.join("."),
                message: issue.message,
              };
            })
          ),
          { status: 400 }
        );
      }

      const url = new URL(result.data);

      const cachedDoc = await client.get<DocResponse>(
        `link-preview:${result.data}`
      );

      if (!cachedDoc) {
        const res = await request({
          headers: {
            "Content-Type": "text/html",
          },
        }).get(result.data);
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
            ? postparsedFavicon.toString()
            : url.origin + "/" + postparsedFavicon.replace(/^\//, "") // remove leading slash
          : undefined;
        const ogImage = postparsedOgImage
          ? isUrl(postparsedOgImage)
            ? postparsedOgImage.toString()
            : url.origin + "/" + postparsedOgImage.replace(/^\//, "") // remove leading slash
          : undefined;
        await client.set(
          `link-preview:${result.data}`,
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
        return NextResponse.json(errorGenerator(error.response.status), {
          status: error.response.status,
        });
      }
      after(() => {
        captureException(error);
      });
      return NextResponse.json(errorGenerator(500), {
        status: 500,
      });
    }
  },
  {
    client,
    onError: (error) => {
      console.error("Rate Limiter: ", error);
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
