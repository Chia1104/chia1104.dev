import { HTTPError } from "ky";
import { parse as parseHTML } from "node-html-parser";

import { isUrl } from "@chia/utils/is";
import request from "@chia/utils/request";

import type { LinkPreview } from "../contracts/toolings.contract";
import { rateLimitGuard } from "../guards/rate-limit.guard";
import { contractOS } from "../utils";

const LINK_PREVIEW_TTL_MS = 60 * 60 * 24 * 1000;

const absolutize = (value: string | null | undefined, origin: string) => {
  if (!value) return undefined;
  return isUrl(value) ? value : `${origin}/${value.replace(/^\//, "")}`;
};

export const linkPreviewRoute = contractOS.toolings["link-preview"]
  .use(rateLimitGuard({ prefix: "rate-limiter:toolings" }))
  .handler(async (opts) => {
    const url = new URL(opts.input.href);
    const cacheKey = `link-preview:${url.toString()}`;

    const cached = await opts.context.kv.get<LinkPreview>(cacheKey);

    if (cached) {
      return {
        title: cached.title,
        description: cached.description,
        favicon: cached.favicon,
        ogImage: cached.ogImage,
      };
    }

    let html: string;

    try {
      const res = await request({
        headers: { "Content-Type": "text/html" },
      }).get(url);
      html = await res.text();
    } catch (error) {
      console.error(error);
      if (error instanceof HTTPError) {
        throw opts.errors.BAD_REQUEST({
          message: `Upstream responded with ${error.response.status}`,
        });
      }
      throw opts.errors.INTERNAL_SERVER_ERROR();
    }

    /**
     * A parser, not a DOM.
     *
     * This used to build a whole `JSDOM` window. Importing jsdom costs ~110MB RSS that is never
     * released — measured against a plain bun runtime — and the four `querySelector` calls below
     * are the entire use for it. `node-html-parser` answers the same selectors for a couple of MB.
     */
    const document = parseHTML(html);

    const preview: LinkPreview = {
      title: document.querySelector("title")?.textContent,
      description: document
        .querySelector('meta[name="description"]')
        ?.getAttribute("content"),
      favicon: absolutize(
        document.querySelector('link[rel="icon"]')?.getAttribute("href"),
        url.origin
      ),
      ogImage: absolutize(
        document
          .querySelector('meta[property="og:image"]')
          ?.getAttribute("content"),
        url.origin
      ),
    };

    await opts.context.kv.set(cacheKey, preview, LINK_PREVIEW_TTL_MS);

    return preview;
  });
