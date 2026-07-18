import { Hono } from "hono";
import { timeout } from "hono/timeout";
import * as z from "zod";

import { tryCatch } from "@chia/utils/error-helper";
import { errorGenerator } from "@chia/utils/server";

import { env } from "../env";
import { internalGuard } from "../guards/internal.guard";
import {
  removeFeedFromSearchIndex,
  syncFeedSearchIndex,
} from "../services/feed-indexing.service";

const feedIndexingSchema = z.object({
  feedID: z.number(),
});

const algoliaDeleteSchema = z.object({
  objectIDs: z.array(z.number()),
});

/**
 * Server-to-server workflow triggers, consumed by apps/service (see its
 * services/feed-indexing.service.ts HTTP client). Workflows must be started
 * in-process here — `start()` needs the compile-time workflow references
 * produced by the workflow/nitro transform, which only this app has.
 */
const api = new Hono<HonoContext>()
  .use(timeout(env.TIMEOUT_MS))
  .use(internalGuard())
  .post("/workflows/feed-indexing", async (c) => {
    const { data: json, error: parseError } = await tryCatch(c.req.json());
    const body = feedIndexingSchema.safeParse(json);
    if (parseError || !body.success) {
      return c.json(errorGenerator(400), 400);
    }

    const run = await syncFeedSearchIndex(body.data.feedID);
    return c.json({ runId: run.runId }, 202);
  })
  .post("/workflows/algolia-delete", async (c) => {
    const { data: json, error: parseError } = await tryCatch(c.req.json());
    const body = algoliaDeleteSchema.safeParse(json);
    if (parseError || !body.success) {
      return c.json(errorGenerator(400), 400);
    }

    const run = await removeFeedFromSearchIndex(body.data.objectIDs);
    return c.json({ runId: run?.runId ?? null }, 202);
  });

export default api;
