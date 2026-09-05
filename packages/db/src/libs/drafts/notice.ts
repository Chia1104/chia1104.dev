import * as z from "zod";

import { FEED_DRAFT_AUTHOR, locale } from "../../schemas/schema.ts";

/**
 * What a `feed_draft` write announces on the Postgres channel, sent from inside the write's
 * transaction so it is delivered on commit and never for a rollback. Pure zod: the wire
 * contract reuses it in the browser.
 */

export const FEED_DRAFT_CHANNEL = "feed_draft";

export const feedDraftNoticeChangeSchema = z.object({
  locale: z.enum(locale.enumValues).optional(),
  fields: z.array(z.string()),
});

export const feedDraftNoticeSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("revision"),
    draftId: z.number().int(),
    revision: z.number().int(),
    author: z.enum([FEED_DRAFT_AUTHOR.Operator, FEED_DRAFT_AUTHOR.Agent]),
    sessionId: z.string().nullable(),
    /** Fields the write touched; bodies stay in the row, well under NOTIFY's 8 kB payload cap. */
    changes: z.array(feedDraftNoticeChangeSchema),
  }),
  z.object({
    type: z.literal("applied"),
    draftId: z.number().int(),
    revision: z.number().int(),
    feedId: z.number().int(),
  }),
  z.object({ type: z.literal("discarded"), draftId: z.number().int() }),
]);

export type FeedDraftNotice = z.infer<typeof feedDraftNoticeSchema>;
