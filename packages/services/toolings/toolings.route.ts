import { HTTPError } from "ky";
import { parse as parseHTML } from "node-html-parser";

import { ApiKeyScope } from "@chia/auth/apikey";
import { CallerTier } from "@chia/auth/tier";
import { getTweet } from "@chia/integrations/x";
import type { TweetResult } from "@chia/integrations/x";
import { logger } from "@chia/observability/logger";
import { isUrl } from "@chia/utils/is";
import request from "@chia/utils/request";

import { contractOS } from "../shared/context";
import { callerGuard } from "../shared/guards/caller.guard";
import { rateLimitGuard } from "../shared/guards/rate-limit.guard";

import type { LinkPreview } from "./toolings.contract";

const HOUR_MS = 60 * 60 * 1000;
const LINK_PREVIEW_TTL_MS = 24 * HOUR_MS;

/** Engagement counts drift, so a found post is refetched daily; a missing one sooner. */
const TWEET_FRESH_MS = { found: 24 * HOUR_MS, unavailable: HOUR_MS };
/** Kept past freshness so an outage of X's unofficial endpoint still renders the last copy. */
const TWEET_RETAIN_MS = 7 * 24 * HOUR_MS;

interface CachedTweet {
  result: TweetResult;
  fetchedAt: number;
}

const absolutize = (value: string | null | undefined, origin: string) => {
  if (!value) return undefined;
  return isUrl(value) ? value : `${origin}/${value.replace(/^\//, "")}`;
};

export const linkPreviewRoute = contractOS.toolings["link-preview"]
  .use(callerGuard())
  .use(rateLimitGuard("toolings"))
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
      if (error instanceof HTTPError) {
        throw opts.errors.BAD_REQUEST({
          message: `Upstream responded with ${error.response.status}`,
          cause: error,
        });
      }
      throw opts.errors.INTERNAL_SERVER_ERROR({ cause: error });
    }

    /** `node-html-parser` instead of jsdom: importing jsdom costs ~110MB RSS that is never released. */
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

export const tweetRoute = contractOS.toolings.tweet
  .use(
    callerGuard({
      minTier: CallerTier.ApiKey,
      scopes: [ApiKeyScope.ToolingsRead],
    })
  )
  .use(rateLimitGuard("toolings"))
  .handler(async (opts) => {
    const cacheKey = `tweet:${opts.input.id}`;
    const cached = await opts.context.kv.get<CachedTweet>(cacheKey);

    if (
      cached &&
      Date.now() - cached.fetchedAt < TWEET_FRESH_MS[cached.result.status]
    ) {
      return cached.result;
    }

    try {
      const result = await getTweet(opts.input.id, opts.signal);
      await opts.context.kv.set<CachedTweet>(
        cacheKey,
        { result, fetchedAt: Date.now() },
        TWEET_RETAIN_MS
      );
      return result;
    } catch (error) {
      if (cached) {
        logger.warn(
          { err: error, id: opts.input.id },
          "Tweet fetch failed; serving the retained result"
        );
        return cached.result;
      }
      throw opts.errors.SERVICE_UNAVAILABLE({ cause: error });
    }
  });

export const toolingsRouter = contractOS.toolings.router({
  "link-preview": linkPreviewRoute,
  tweet: tweetRoute,
});
