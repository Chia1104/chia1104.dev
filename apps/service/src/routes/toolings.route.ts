import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { JSDOM } from "jsdom";
import { HTTPError } from "ky";

import { previewSchema } from "@chia/ui/link";
import type { DocResponse } from "@chia/ui/link";
import { isUrl } from "@chia/utils/is";
import request from "@chia/utils/request";
import { errorGenerator } from "@chia/utils/server";

import { errorResponse } from "@/utils/error.util";

const api = new Hono<HonoContext>();

api.post(
  "/link-preview",
  zValidator("json", previewSchema, (result, c) => {
    if (!result.success) {
      return c.json(errorResponse(result.error), 400);
    }
  }),
  async (c) => {
    try {
      const url = new URL(c.req.valid("json").href);

      const cachedDoc = await c.var.kv.get<DocResponse>(
        `link-preview:${url.toString()}`
      );

      if (!cachedDoc) {
        const res = await request({
          headers: {
            "Content-Type": "text/html",
          },
        }).get(url);
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

        await c.var.kv.set(
          `link-preview:${url.toString()}`,
          {
            title,
            description,
            favicon,
            ogImage,
          },
          60 * 60 * 24 * 1000
        );
        return c.json<DocResponse>({
          title,
          description,
          favicon,
          ogImage,
        });
      }

      return c.json<DocResponse>({
        title: cachedDoc.title,
        description: cachedDoc.description,
        favicon: cachedDoc.favicon,
        ogImage: cachedDoc.ogImage,
      });
    } catch (error) {
      console.error(error);
      if (error instanceof HTTPError) {
        return c.json(errorGenerator(error.response.status), 500);
      }
      return c.json(errorGenerator(500), {
        status: 500,
      });
    }
  }
);

export default api;
