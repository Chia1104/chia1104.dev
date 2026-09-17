import { asyncIteratorObject, oc } from "@orpc/contract";
import * as z from "zod";

import { locale } from "@chia/db/schema/enums";
import { FeedOrderBy, FeedType, Locale } from "@chia/db/types";
import {
  feedSchema,
  feedTranslationSchema,
  insertFeedSchema,
} from "@chia/db/validator/feeds";
import { keysetCursorSchema } from "@chia/db/validator/shared";

import { withMetaSchema } from "../shared/schema";

import type { SearchFeedsServiceResult } from "./search.service";
import {
  publicFeedSearchItemSchema,
  searchFeedsSchema,
  upsertContentRequestSchema,
  upsertFeedTranslationRequestSchema,
} from "./validator";

/** One feed surface; scope widens with `context.caller.tier`. See `access.ts`. */

const dateFields = {
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
};

export const createFeedSchema = insertFeedSchema
  .omit({ userId: true, createdAt: true, updatedAt: true })
  .extend({
    slug: z.string().min(1),
    /** Partial: a post may exist in one locale. The write service requires the default one. */
    translations: z.partialRecord(
      z.enum(locale.enumValues),
      z.object({
        title: z.string().min(1),
        excerpt: z.string().optional().nullable(),
        description: z.string().optional().nullable(),
        summary: z.string().optional().nullable(),
        readTime: z.number().optional().nullable(),
        /** MDX body. */
        content: z.string().optional().nullable(),
      })
    ),
    ...dateFields,
  });

export type CreateFeedInput = z.infer<typeof createFeedSchema>;

export const updateFeedSchema = insertFeedSchema
  .omit({
    userId: true,
    createdAt: true,
    updatedAt: true,
    slug: true,
  })
  .partial()
  .extend({
    feedId: z.number(),
    translations: z
      .partialRecord(
        z.enum(locale.enumValues),
        z.object({
          title: z.string().min(1).optional(),
          excerpt: z.string().optional().nullable(),
          description: z.string().optional().nullable(),
          summary: z.string().optional().nullable(),
          readTime: z.number().optional().nullable(),
          /** MDX body; omit to leave the stored body alone. */
          content: z.string().optional().nullable(),
        })
      )
      .optional(),
    ...dateFields,
  });

export const deleteFeedSchema = z.object({
  feedId: z.number(),
  hard: z.boolean().optional().default(false),
});

export const restoreFeedSchema = z.object({
  feedId: z.number(),
});

/**
 * Accepts a JSON boolean or its query-string spelling, so the same schema works over RPC
 * (real JSON) and over the OpenAPI mount (every value a string).
 */
const flexibleBoolean = z.union([z.boolean(), z.stringbool()]);

/** `resolveFeedVisibility` clamps each flag for callers below the required tier rather than rejecting, so a browser that sends `includeUnpublished` receives the published set instead of a 403. */
const feedVisibilityFields = {
  /** Include drafts. Requires an API key or a session. */
  includeUnpublished: flexibleBoolean.optional().default(false),
  /** Include soft-deleted feeds. Requires a session. */
  includeDeleted: flexibleBoolean.optional().default(false),
};

const localeQueryFields = {
  locale: z.enum(locale.enumValues).optional().default(Locale.zhTW),
};

/** `userId` is absent: this is a single-author site, so the author is derived from the caller's tier. */
export const feedsInfiniteSchema = z.object({
  /**
   * Clamped per tier by `resolveFeedLimit` — an anonymous caller cannot walk the whole
   * table in one call, while `apps/www`'s sitemap can ask for 1000 with its API key.
   */
  limit: z.coerce.number().int().positive().optional().default(20),
  nextCursor: keysetCursorSchema.optional(),
  withContent: flexibleBoolean.optional().default(false),
  orderBy: z.enum(FeedOrderBy).optional().default(FeedOrderBy.CreatedAt),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  type: z.enum(FeedType).optional(),
  ...localeQueryFields,
  ...feedVisibilityFields,
});

export const getFeedBySlugSchema = z.object({
  slug: z.string().min(1),
  ...localeQueryFields,
  ...feedVisibilityFields,
});

/**
 * No locale default: the dash edit view needs every translation. Defaulting to `zh-TW`
 * filtered the rest out.
 */
export const getFeedByIdSchema = z.object({
  feedId: z.coerce.number().int(),
  locale: z.enum(locale.enumValues).optional(),
  ...feedVisibilityFields,
});

/**
 * `published`/`deleted` stay on the feed. Body columns are optional because list
 * queries skip them unless `withContent` was set.
 */
const translationOutputSchema = feedTranslationSchema
  .omit({
    createdAt: true,
    updatedAt: true,
    published: true,
    deleted: true,
    content: true,
  })
  .extend({
    content: z.string().nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
    hasEmbedding: z.boolean(),
  });

export const feedWithTranslationsSchema = feedSchema.extend({
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  translations: z.array(translationOutputSchema),
  feedsToTags: z
    .array(
      z.object({
        tag: z
          .object({
            id: z.number(),
            slug: z.string(),
            translations: z.array(
              z.object({
                id: z.number(),
                name: z.string(),
                locale: z.enum(locale.enumValues),
                description: z.string().nullable(),
              })
            ),
          })
          .nullable(),
      })
    )
    .optional(),
});

export const feedListSchema = feedWithTranslationsSchema;

export const relatedFeedItemSchema = z.object({
  id: z.number(),
  type: z.string(),
  slug: z.string(),
  locale: z.enum(locale.enumValues),
  title: z.string(),
  description: z.string().nullable(),
  excerpt: z.string().nullable(),
  createdAt: z.union([z.string(), z.date()]),
  similarity: z.number().optional(),
});

const READ_ERRORS = {
  UNAUTHORIZED: {},
  FORBIDDEN: {},
  NOT_FOUND: {},
  TOO_MANY_REQUESTS: {},
  INTERNAL_SERVER_ERROR: {},
} as const;

export const getFeedsContract = oc
  .errors(READ_ERRORS)
  .input(feedsInfiniteSchema)
  .output(
    withMetaSchema(feedListSchema).extend({
      /** Narrowed from `withMetaSchema`: a `(order column, id)` keyset cursor. */
      nextCursor: z.string().nullable(),
    })
  );

export const getFeedBySlugContract = oc
  .errors(READ_ERRORS)
  .input(getFeedBySlugSchema)
  .output(feedWithTranslationsSchema);

export const getFeedByIdContract = oc
  .errors(READ_ERRORS)
  .input(getFeedByIdSchema)
  .output(feedWithTranslationsSchema);

export const getRelatedFeedsContract = oc
  .errors(READ_ERRORS)
  .input(
    z.object({
      slug: z.string().min(1),
      ...localeQueryFields,
      limit: z.coerce.number().int().min(1).max(6).optional().default(3),
    })
  )
  .output(z.object({ items: z.array(relatedFeedItemSchema) }));

// Two procedures: `search` returns display items; `search:advanced` returns whichever
// shape the retrieval mode produced.

export const searchFeedsContract = oc
  .errors({
    BAD_REQUEST: {},
    TOO_MANY_REQUESTS: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(
    z.object({
      keyword: z.string().trim().min(2).max(100),
      ...localeQueryFields,
      limit: z.coerce.number().int().min(1).max(10).optional().default(5),
    })
  )
  .output(z.object({ items: z.array(publicFeedSearchItemSchema) }));

/**
 * Output is `z.custom` because the payload shape depends on the requested retrieval mode
 * and all of them are pass-through; mirroring each shape in a zod union would duplicate
 * types the repositories already own.
 */
export const searchFeedsAdvancedContract = oc
  .errors({
    BAD_REQUEST: {},
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    TOO_MANY_REQUESTS: {},
    SERVICE_UNAVAILABLE: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(
    searchFeedsSchema.extend({
      locale: z.enum(locale.enumValues).optional(),
    })
  )
  .output(z.custom<SearchFeedsServiceResult>());

const WRITE_ERRORS = {
  UNAUTHORIZED: {},
  FORBIDDEN: {},
  NOT_FOUND: {},
  BAD_REQUEST: {},
  INTERNAL_SERVER_ERROR: {},
} as const;

export const createFeedContract = oc
  .errors(WRITE_ERRORS)
  .input(createFeedSchema);

export const updateFeedContract = oc
  .errors(WRITE_ERRORS)
  .input(updateFeedSchema);

export const deleteFeedContract = oc
  .errors(WRITE_ERRORS)
  .input(deleteFeedSchema);

export const restoreFeedContract = oc
  .errors(WRITE_ERRORS)
  .input(restoreFeedSchema);

export const upsertFeedTranslationContract = oc
  .errors(WRITE_ERRORS)
  .input(upsertFeedTranslationRequestSchema)
  .output(z.void());

export const upsertContentContract = oc
  .errors(WRITE_ERRORS)
  .input(upsertContentRequestSchema)
  .output(z.void());

/**
 * The working draft of a post, shared by the dashboard editor and the writing agent. Applying it
 * is what commits a version; `contentHash` names the content, `revision` only orders writes.
 */

export const feedDraftTranslationSchema = z.object({
  title: z.string().nullable(),
  excerpt: z.string().nullable(),
  description: z.string().nullable(),
  summary: z.string().nullable(),
  content: z.string().nullable(),
});

export const feedDraftSchema = z.object({
  id: z.number().int(),
  /** `null` until the draft has been applied once. */
  feedId: z.number().int().nullable(),
  /** Orders writes. `contentHash` is what identifies a version. */
  revision: z.number().int(),
  contentHash: z.string(),
  /** The commit the post holds; `null` until the draft has been applied once. */
  appliedRevisionId: z.number().int().nullable(),
  /** That commit's `contentHash`. The draft has unapplied work while its own differs. */
  appliedHash: z.string().nullable(),
  slug: z.string().nullable(),
  type: z.enum([FeedType.Post, FeedType.Note]),
  defaultLocale: z.enum(locale.enumValues),
  mainImage: z.string().nullable(),
  translations: z.partialRecord(
    z.enum(locale.enumValues),
    feedDraftTranslationSchema
  ),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type FeedDraftOutput = z.infer<typeof feedDraftSchema>;

/** A draft as listed: titles only, so a list stays small however long the bodies are. */
export const feedDraftSummarySchema = feedDraftSchema
  .omit({ translations: true })
  .extend({
    translations: z.partialRecord(
      z.enum(locale.enumValues),
      z.object({ title: z.string().nullable() })
    ),
  });

export type FeedDraftSummaryOutput = z.infer<typeof feedDraftSummarySchema>;

const feedDraftTranslationPatchSchema = feedDraftTranslationSchema.partial();

const feedDraftFieldsSchema = z.object({
  slug: z.string().nullable().optional(),
  type: z.enum([FeedType.Post, FeedType.Note]).optional(),
  defaultLocale: z.enum(locale.enumValues).optional(),
  mainImage: z.string().nullable().optional(),
  translations: z
    .partialRecord(z.enum(locale.enumValues), feedDraftTranslationPatchSchema)
    .optional(),
});

export const feedDraftContentEditSchema = z.object({
  /** Matched byte for byte against the current body. */
  oldString: z.string().min(1),
  /** Empty deletes the match. */
  newString: z.string(),
  /** Replace every match instead of refusing an ambiguous target. */
  replaceAll: z.boolean().optional(),
});

/**
 * Every field written is guarded: by its entry in `base`, or by `expectedRevision` for the
 * whole call. Guarded by `base`, a write lands beside another writer's change to a different
 * field and answers `CONFLICT` with `rejected` when one of its own fields moved.
 */
export const patchFeedDraftSchema = feedDraftFieldsSchema.extend({
  draftId: z.number().int(),
  expectedRevision: z.number().int().optional(),
  /** What the caller last saw of the fields it writes. */
  base: feedDraftFieldsSchema.optional(),
  /** Replacements in a locale's body, matched byte for byte; not together with that locale's `content`. */
  edits: z
    .partialRecord(
      z.enum(locale.enumValues),
      z.array(feedDraftContentEditSchema).min(1).max(200)
    )
    .optional(),
});

export type PatchFeedDraftInput = z.infer<typeof patchFeedDraftSchema>;

export const feedDraftChangeSchema = z.object({
  locale: z.enum(locale.enumValues).optional(),
  fields: z.array(z.string()),
});

/** `commit` is a version applied to the post; `safety` a restore point kept by the write path. */
const feedDraftRevisionKindSchema = z.enum(["commit", "safety"]);

export const feedDraftRevisionSchema = z.object({
  id: z.number().int(),
  kind: feedDraftRevisionKindSchema,
  revision: z.number().int(),
  /** Who last wrote the state this row holds. */
  author: z.enum(["operator", "agent"]),
  sessionId: z.string().nullable(),
  message: z.string().nullable(),
  pinned: z.boolean(),
  /** Fields that differ from the row before. */
  changes: z.array(feedDraftChangeSchema),
  contentHash: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const DRAFT_ERRORS = {
  UNAUTHORIZED: {},
  FORBIDDEN: {},
  NOT_FOUND: {},
  BAD_REQUEST: {},
  INTERNAL_SERVER_ERROR: {},
} as const;

/** What the draft holds now, so the caller can read it again and decide on that. */
const DRAFT_CONFLICT = {
  CONFLICT: {
    data: z.object({
      revision: z.number().int(),
      contentHash: z.string(),
      /** The fields of a `base`-guarded patch that moved; absent for a whole-draft mismatch. */
      rejected: z
        .array(
          z.object({
            /** `null` for a feed-level field. */
            locale: z.enum(locale.enumValues).nullable(),
            field: z.string(),
            reason: z.string(),
          })
        )
        .optional(),
    }),
  },
} as const;

/** The `contentHash` the caller decided on; a draft holding anything else answers `CONFLICT`. */
const expectedHashSchema = z.string().min(1);

/** Get-or-create: a feed's working draft, or an empty draft for a new post when `feedId` is omitted. */
export const openFeedDraftContract = oc
  .errors(DRAFT_ERRORS)
  .input(z.object({ feedId: z.number().int().optional() }))
  .output(feedDraftSchema);

export const getFeedDraftContract = oc
  .errors(DRAFT_ERRORS)
  .input(z.object({ draftId: z.number().int() }))
  .output(feedDraftSchema);

/** Drafts with unapplied work: never applied, or edited since the last apply. Bodies are in `draft:get`. */
export const listFeedDraftsContract = oc
  .errors(DRAFT_ERRORS)
  .output(z.object({ items: z.array(feedDraftSummarySchema) }));

export const patchFeedDraftContract = oc
  .errors({ ...DRAFT_ERRORS, ...DRAFT_CONFLICT })
  .input(patchFeedDraftSchema)
  .output(feedDraftSchema);

export const editFeedDraftSchema = z.object({
  draftId: z.number().int(),
  locale: z.enum(locale.enumValues),
  /** Applied in order as one revision; a target that does not match once refuses the batch. */
  edits: z.array(feedDraftContentEditSchema).min(1).max(50),
  /** Omit to edit whatever is current; an exact match makes that safe. */
  expectedRevision: z.number().int().optional(),
});

export type EditFeedDraftInput = z.infer<typeof editFeedDraftSchema>;

/** Exact-string replacements in one locale's body, applied under the draft lock. */
export const editFeedDraftContract = oc
  .errors({ ...DRAFT_ERRORS, ...DRAFT_CONFLICT })
  .input(editFeedDraftSchema)
  .output(
    z.object({
      draftId: z.number().int(),
      locale: z.enum(locale.enumValues),
      revision: z.number().int(),
      /** Across every edit. */
      replacements: z.number().int(),
      /** Per edit, in input order: how many places, how loosely, and the numbered lines around the first. */
      edits: z.array(
        z.object({
          replacements: z.number().int(),
          match: z.enum([
            "exact",
            "trailing_whitespace",
            "whitespace",
            "punctuation",
          ]),
          line: z.number().int(),
          context: z.string(),
        })
      ),
    })
  );

/** Writes the draft to its post and commits that content as a version of the draft. */
export const applyFeedDraftContract = oc
  .errors({ ...DRAFT_ERRORS, ...DRAFT_CONFLICT })
  .input(
    z.object({
      draftId: z.number().int(),
      expectedHash: expectedHashSchema,
      /** Omit to describe the commit by the fields that changed. */
      message: z.string().trim().max(200).optional(),
    })
  )
  .output(
    z.object({
      feedId: z.number().int(),
      slug: z.string(),
      created: z.boolean(),
      revisionId: z.number().int(),
      contentHash: z.string(),
    })
  );

export const discardFeedDraftContract = oc
  .errors({ ...DRAFT_ERRORS, ...DRAFT_CONFLICT })
  .input(
    z.object({ draftId: z.number().int(), expectedHash: expectedHashSchema })
  )
  .output(z.void());

export const listFeedDraftRevisionsContract = oc
  .errors(DRAFT_ERRORS)
  .input(
    z.object({
      draftId: z.number().int(),
      /** Omit for the whole trail. */
      kind: feedDraftRevisionKindSchema.optional(),
      limit: z.number().int().min(1).max(100).optional().default(30),
    })
  )
  .output(z.object({ items: z.array(feedDraftRevisionSchema) }));

const feedDraftSnapshotSchema = feedDraftSchema.pick({
  slug: true,
  type: true,
  defaultLocale: true,
  mainImage: true,
  translations: true,
});

/** One kept state with the content it holds, and the state its row is read against. */
export const getFeedDraftRevisionContract = oc
  .errors(DRAFT_ERRORS)
  .input(z.object({ draftId: z.number().int(), revisionId: z.number().int() }))
  .output(
    feedDraftRevisionSchema.extend({
      snapshot: feedDraftSnapshotSchema,
      /** The commit before a commit, the row before a restore point; `null` for the first. */
      base: feedDraftSnapshotSchema.nullable(),
    })
  );

/** Keeps a restore point out of pruning, optionally under a name. Commits are kept anyway and answer `NOT_FOUND`. */
export const pinFeedDraftRevisionContract = oc
  .errors(DRAFT_ERRORS)
  .input(
    z.object({
      draftId: z.number().int(),
      revisionId: z.number().int(),
      pinned: z.boolean(),
      /** Omit to leave the name as it is; `null` clears it. */
      label: z.string().trim().min(1).max(200).nullable().optional(),
    })
  )
  .output(feedDraftRevisionSchema);

export const restoreFeedDraftRevisionContract = oc
  .errors({ ...DRAFT_ERRORS, ...DRAFT_CONFLICT })
  .input(
    z.object({
      draftId: z.number().int(),
      revisionId: z.number().int(),
      expectedHash: expectedHashSchema,
    })
  )
  .output(feedDraftSchema);

/** Resync invalidates the draft query; ping only keeps the connection alive. */
export const feedDraftWatchEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("resync") }),
  z.object({ type: z.literal("ping") }),
]);

export type FeedDraftWatchEvent = z.infer<typeof feedDraftWatchEventSchema>;

export const watchFeedDraftContract = oc
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    NOT_FOUND: {},
    SERVICE_UNAVAILABLE: {},
  })
  .input(z.object({ draftId: z.number().int() }))
  .output(asyncIteratorObject(feedDraftWatchEventSchema));

export const feedsContract = {
  list: getFeedsContract,
  "details-by-slug": getFeedBySlugContract,
  "details-by-id": getFeedByIdContract,
  related: getRelatedFeedsContract,
  search: searchFeedsContract,
  "search:advanced": searchFeedsAdvancedContract,
  create: createFeedContract,
  update: updateFeedContract,
  delete: deleteFeedContract,
  restore: restoreFeedContract,
  "translation:upsert": upsertFeedTranslationContract,
  "content:upsert": upsertContentContract,
  "draft:open": openFeedDraftContract,
  "draft:get": getFeedDraftContract,
  "draft:list": listFeedDraftsContract,
  "draft:patch": patchFeedDraftContract,
  "draft:edit": editFeedDraftContract,
  "draft:apply": applyFeedDraftContract,
  "draft:discard": discardFeedDraftContract,
  "draft:revisions": listFeedDraftRevisionsContract,
  "draft:revision": getFeedDraftRevisionContract,
  "draft:pin": pinFeedDraftRevisionContract,
  "draft:restore": restoreFeedDraftRevisionContract,
  "draft:watch": watchFeedDraftContract,
};
