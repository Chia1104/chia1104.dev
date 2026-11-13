import { createHash, randomBytes } from "node:crypto";

import { isbot } from "isbot";
import type Keyv from "keyv";
import type * as z from "zod";

import { CallerTier } from "@chia/auth/tier";
import { insertPageView } from "@chia/db/repos/stats";
import { FeedType } from "@chia/db/types";
import { WWW_BASE_URL } from "@chia/utils/config";

import type { CallerContext } from "../shared/guards/caller.guard";

import type { pageViewSchema } from "./stats.contract";

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** A reader opening the same page again within this window is one view. */
const REPEAT_WINDOW_MS = 30 * MINUTE_MS;

/** Readers only: an API-key caller is a server, and the operator's own browsing is not a view. */
const COUNTED_TIERS = new Set<CallerTier>([
  CallerTier.Anonymous,
  CallerTier.Guest,
  CallerTier.Session,
]);

const SITE_HOST = new URL(WWW_BASE_URL).hostname;

/** Posts and notes live at `/${type}s/${slug}`, the path `feedUrl` builds. */
const FEED_PATH = /^\/([a-z]+)s\/([^/]+)$/;

const feedOf = (path: string) => {
  const [, type, slug] = FEED_PATH.exec(path) ?? [];
  if (!slug) return null;
  if (type === FeedType.Post || type === FeedType.Note) return { type, slug };
  return null;
};

const externalHost = (referrer: string | undefined) => {
  if (!referrer) return null;
  const { hostname } = new URL(referrer);
  const internal = hostname === SITE_HOST || hostname.endsWith(`.${SITE_HOST}`);
  return internal ? null : hostname;
};

/**
 * One salt per UTC day, dropped the day after, so a visitor hash cannot be rebuilt once its day
 * is over. `null` when the store cannot hold it, and then nothing is recorded.
 */
const dailySalt = async (kv: Keyv, day: string): Promise<string | null> => {
  const key = `stats:salt:${day}`;
  const stored = await kv.get<string>(key);
  if (stored) return stored;
  await kv.set(key, randomBytes(16).toString("base64url"), 2 * DAY_MS);
  // Two first requests of a day can race; both read back whichever write landed.
  return (await kv.get<string>(key)) ?? null;
};

/** Records one page view unless it comes from a crawler, the operator, or a repeat. */
export const recordPageView = async (
  context: Pick<CallerContext, "db" | "kv" | "headers" | "clientIP" | "caller">,
  input: z.infer<typeof pageViewSchema>
): Promise<void> => {
  if (!COUNTED_TIERS.has(context.caller.tier)) return;
  const userAgent = context.headers.get("user-agent");
  if (!userAgent || isbot(userAgent)) return;

  const day = new Date().toISOString().slice(0, 10);
  const salt = await dailySalt(context.kv, day);
  if (!salt) return;
  const visitor = createHash("sha256")
    .update(`${salt}\n${context.clientIP}\n${userAgent}`)
    .digest("base64url")
    .slice(0, 22);

  const seenKey = `stats:seen:${visitor}:${input.path}`;
  if (await context.kv.get(seenKey)) return;
  await context.kv.set(seenKey, true, REPEAT_WINDOW_MS);

  await insertPageView(context.db, {
    path: input.path,
    locale: input.locale,
    visitor,
    feed: feedOf(input.path),
    referrerHost: externalHost(input.referrer),
    country: context.headers.get("cf-ipcountry"),
  });
};
