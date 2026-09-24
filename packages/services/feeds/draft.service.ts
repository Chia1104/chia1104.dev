import type { DB } from "@chia/db/client";
import {
  commitFeedDraft,
  createFeedDraft,
  deleteUnboundFeedDraft,
  editFeedDraftContent,
  getFeedDraft,
  getFeedDraftByFeedId,
  getFeedDraftForUpdate,
  getFeedDraftRevision,
  patchFeedDraft,
  replaceFeedDraft,
  snapshotOfRevision,
} from "@chia/db/repos/drafts";
import type {
  FeedDraftContentEdit,
  FeedDraftRecord,
  FeedDraftSnapshot,
  FeedDraftWriter,
} from "@chia/db/repos/drafts";
import {
  definedKeys,
  META_FIELDS,
  TRANSLATION_FIELDS,
} from "@chia/db/repos/drafts/patch";
import type { FeedDraftFields } from "@chia/db/repos/drafts/patch";
import { resolveFeedReports } from "@chia/db/repos/feed-reports";
import { getFeedForIndexing } from "@chia/db/repos/feeds";
import { FeedDraftAuthor } from "@chia/db/schema";
import { Locale } from "@chia/db/types";
import { reportError } from "@chia/observability/report";
import { AppError, AppErrorCode } from "@chia/service-kit/errors";
import { normalizeAsciiSlug } from "@chia/utils/slug";
import { excerptAround } from "@chia/utils/text";
import type { MatchMode } from "@chia/utils/text";

import type { FeedHooks } from "../shared/context";

import { createFeedService, updateFeedService } from "./write.service";
import type { CreateFeedTranslationInput } from "./write.service";

/**
 * The working draft shared by the dashboard editor and the writing agent. Shared by oRPC
 * (operator) and the agent's draft store and content port (workflow step). Authorisation
 * belongs at the transport boundary; `adminId` is the configured author.
 */

const requireDraft = async (
  db: DB,
  draftId: number,
  adminId: string
): Promise<FeedDraftRecord> => {
  const draft = await getFeedDraft(db, draftId, adminId);
  if (!draft) {
    throw new AppError(AppErrorCode.NotFound, {
      message: `Draft ${draftId} not found`,
    });
  }
  return draft;
};

const feedSnapshot = async (
  db: DB,
  feedId: number,
  adminId: string
): Promise<FeedDraftSnapshot> => {
  const feed = await getFeedForIndexing(db, { feedId });
  if (!feed || feed.userId !== adminId || feed.deletedAt) {
    throw new AppError(AppErrorCode.NotFound, {
      message: `Feed ${feedId} not found`,
    });
  }
  const translations: FeedDraftSnapshot["translations"] = {};
  for (const translation of feed.translations) {
    translations[translation.locale] = {
      title: translation.title,
      excerpt: translation.excerpt,
      description: translation.description,
      content: translation.content,
    };
  }
  return {
    slug: feed.slug,
    type: feed.type,
    defaultLocale: feed.defaultLocale,
    mainImage: feed.mainImage,
    translations,
  };
};

export interface OpenFeedDraftInput extends FeedDraftWriter {
  adminId: string;
  /** An existing draft, e.g. the one open in the editor. Wins over `feedId`. */
  draftId?: number;
  /** Opens the feed's working draft, creating it from the feed when there is none. */
  feedId?: number;
}

/** Get-or-create. With neither id this starts an empty draft for a new post. */
export const openFeedDraftService = async (
  db: DB,
  input: OpenFeedDraftInput
): Promise<FeedDraftRecord> => {
  if (input.draftId !== undefined) {
    return requireDraft(db, input.draftId, input.adminId);
  }
  if (input.feedId === undefined) {
    return createFeedDraft(db, {
      userId: input.adminId,
      author: input.author,
      sessionId: input.sessionId,
    });
  }
  const existing = await getFeedDraftByFeedId(db, input.feedId);
  if (existing) {
    if (existing.userId !== input.adminId) {
      throw new AppError(AppErrorCode.NotFound, {
        message: `Feed ${input.feedId} not found`,
      });
    }
    return existing;
  }
  return createFeedDraft(db, {
    userId: input.adminId,
    feedId: input.feedId,
    snapshot: await feedSnapshot(db, input.feedId, input.adminId),
    applied: true,
    author: input.author,
    sessionId: input.sessionId,
  });
};

export const getFeedDraftService = (
  db: DB,
  input: { draftId: number; adminId: string }
) => requireDraft(db, input.draftId, input.adminId);

export interface PatchFeedDraftServiceInput
  extends FeedDraftWriter, FeedDraftFields {
  draftId: number;
  adminId: string;
  expectedRevision?: number;
  base?: FeedDraftFields;
  edits?: Partial<Record<Locale, readonly FeedDraftContentEdit[]>>;
}

/** Fields written without a base, which only `expectedRevision` may guard. */
const unguardedFields = (input: PatchFeedDraftServiceInput): string[] => {
  const unguarded: string[] = [];
  if (input.meta) {
    for (const field of definedKeys(input.meta, META_FIELDS)) {
      if (input.base?.meta?.[field] === undefined) unguarded.push(field);
    }
  }
  for (const locale of Object.values(Locale)) {
    const patch = input.translations?.[locale];
    if (!patch) continue;
    for (const field of definedKeys(patch, TRANSLATION_FIELDS)) {
      if (input.base?.translations?.[locale]?.[field] === undefined) {
        unguarded.push(`${locale}.${field}`);
      }
    }
  }
  return unguarded;
};

/**
 * Every field must be guarded, by its `base` or by `expectedRevision`. Throws `CONFLICT` naming
 * what the draft holds now, and the fields that moved, when the draft is not what the caller
 * wrote against; nothing of the patch is written then.
 */
export const patchFeedDraftService = async (
  db: DB,
  input: PatchFeedDraftServiceInput
): Promise<FeedDraftRecord> => {
  if (input.expectedRevision === undefined) {
    const unguarded = unguardedFields(input);
    if (unguarded.length > 0) {
      throw new AppError(AppErrorCode.BadRequest, {
        message: `Pass what you last saw of ${unguarded.join(", ")} in \`base\`, or the draft's \`expectedRevision\`, so the write cannot bury a change you have not seen.`,
      });
    }
  }
  for (const locale of Object.values(Locale)) {
    if (!input.edits || !Object.hasOwn(input.edits, locale)) continue;
    if (input.translations?.[locale]?.content !== undefined) {
      throw new AppError(AppErrorCode.BadRequest, {
        message: `Write the "${locale}" body or edit it, not both in one call.`,
      });
    }
  }

  const meta = { ...input.meta };
  if (meta.slug !== undefined && meta.slug !== null) {
    const slug = normalizeAsciiSlug(meta.slug);
    if (!slug) {
      throw new AppError(AppErrorCode.BadRequest, {
        message:
          "Feed slug must be an English/ASCII phrase. Slug normalization does not translate or transliterate titles.",
      });
    }
    meta.slug = slug;
  }

  const result = await patchFeedDraft(db, {
    draftId: input.draftId,
    userId: input.adminId,
    expectedRevision: input.expectedRevision,
    author: input.author,
    sessionId: input.sessionId,
    meta,
    translations: input.translations,
    base: input.base,
    edits: input.edits,
  });
  return unwrapWrite(result, input.draftId);
};

export interface EditFeedDraftContentServiceInput extends FeedDraftWriter {
  draftId: number;
  adminId: string;
  locale: Locale;
  edits: readonly FeedDraftContentEdit[];
  expectedRevision?: number;
}

/** One edit as it landed: how many places, how loosely, and the numbered lines around the first. */
export interface AppliedDraftEdit {
  replacements: number;
  match: MatchMode;
  line: number;
  context: string;
}

export interface EditFeedDraftContentResult {
  draft: FeedDraftRecord;
  edits: AppliedDraftEdit[];
}

/** Lines around each edit, so the caller sees where it landed without reading the body again. */
const CONTEXT_RADIUS = 2;

/**
 * A target that does not match exactly once is `BAD_REQUEST` naming the edit's index; nothing
 * of the batch is written.
 */
export const editFeedDraftContentService = async (
  db: DB,
  input: EditFeedDraftContentServiceInput
): Promise<EditFeedDraftContentResult> => {
  const result = await editFeedDraftContent(db, {
    draftId: input.draftId,
    userId: input.adminId,
    locale: input.locale,
    edits: input.edits,
    expectedRevision: input.expectedRevision,
    author: input.author,
    sessionId: input.sessionId,
  });
  switch (result.status) {
    case "ok": {
      const content = result.draft.translations[input.locale]?.content ?? "";
      return {
        draft: result.draft,
        edits: result.edits.map((edit) => {
          const { line, text } = excerptAround(
            content,
            edit.offsets[0] ?? 0,
            CONTEXT_RADIUS
          );
          return {
            replacements: edit.replacements,
            match: edit.match,
            line,
            context: text,
          };
        }),
      };
    }
    case "no_body":
      throw new AppError(AppErrorCode.BadRequest, {
        message: `Draft ${input.draftId} has no "${input.locale}" body yet; write one before editing it.`,
      });
    case "not_applied":
      throw new AppError(AppErrorCode.BadRequest, {
        message: `Edit ${result.index + 1} of ${input.edits.length} was not applied, so nothing was written. ${result.message}`,
        data: { index: result.index, reason: result.reason },
      });
    default:
      return { draft: unwrapWrite(result, input.draftId), edits: [] };
  }
};

const conflictData = (draft: FeedDraftRecord) => ({
  revision: draft.revision,
  contentHash: draft.contentHash,
});

const unwrapWrite = (
  result: Awaited<ReturnType<typeof patchFeedDraft>>,
  draftId: number
): FeedDraftRecord => {
  switch (result.status) {
    case "ok":
      return result.draft;
    case "conflict":
      throw new AppError(AppErrorCode.Conflict, {
        message: `Draft ${draftId} was changed by someone else; reload it and try again.`,
        data: result.rejected
          ? {
              ...conflictData(result.draft),
              rejected: result.rejected.map(({ locale, field, reason }) => ({
                locale: locale ?? null,
                field,
                reason,
              })),
            }
          : conflictData(result.draft),
      });
    case "not_found":
      throw new AppError(AppErrorCode.NotFound, {
        message: `Draft ${draftId} not found`,
      });
  }
};

export interface ApplyFeedDraftResult {
  feedId: number;
  slug: string;
  created: boolean;
  /** The commit `feed` now holds. */
  revisionId: number;
  contentHash: string;
}

/**
 * Writes the draft onto `feed` and `feed_translation`, creating an unpublished feed the first
 * time, and commits that content as a version of the draft. Publishing is a separate feed
 * write. The draft stays open as the working copy.
 *
 * The draft row is locked and its content checked against `expectedHash` in the same
 * transaction that writes the feed, so what lands is the content the caller decided on and
 * nothing written since. The post's in-progress reader reports resolve in that transaction.
 * Feed hooks run after it commits.
 */
export const applyFeedDraftService = async (
  db: DB,
  input: {
    draftId: number;
    adminId: string;
    expectedHash: string;
    message?: string | null;
  },
  hooks: FeedHooks
): Promise<ApplyFeedDraftResult> => {
  const changed: number[] = [];
  const deferred: FeedHooks = {
    onFeedChanged: async (feedID) => {
      changed.push(feedID);
    },
  };
  const result = await db.transaction(async (tx) => {
    const locked = await getFeedDraftForUpdate(tx, input.draftId);
    if (!locked || locked.userId !== input.adminId) {
      throw new AppError(AppErrorCode.NotFound, {
        message: `Draft ${input.draftId} not found`,
      });
    }
    if (locked.contentHash !== input.expectedHash) {
      throw new AppError(AppErrorCode.Conflict, {
        message: `Draft ${input.draftId} holds ${locked.contentHash.slice(0, 7)}, not ${input.expectedHash.slice(0, 7)}: it changed after it was decided on. Read it again and decide on what it holds now.`,
        data: conflictData(locked),
      });
    }
    const applied = await applyLockedDraft(tx, locked, input, deferred);
    await resolveFeedReports(tx, applied.feedId);
    return applied;
  });
  // The feed is committed; a hook that cannot start indexing does not unmake that, so the
  // caller hears the truth and the index catches up on the next apply or publish.
  for (const feedID of changed) {
    try {
      await hooks.onFeedChanged?.(feedID);
    } catch (error) {
      reportError(
        error,
        "Feed change hook failed after the draft was applied",
        {
          draftId: input.draftId,
          feedID,
        }
      );
    }
  }
  return result;
};

const applyLockedDraft = async (
  db: DB,
  draft: FeedDraftRecord,
  { adminId, message }: { adminId: string; message?: string | null },
  hooks: FeedHooks
): Promise<ApplyFeedDraftResult> => {
  const locales = Object.values(Locale).filter(
    (locale) => draft.translations[locale] !== undefined
  );

  if (locales.length === 0) {
    throw new AppError(AppErrorCode.BadRequest, {
      message: "The draft is empty. Write at least one locale before applying.",
    });
  }
  if (!draft.translations[draft.defaultLocale]) {
    throw new AppError(AppErrorCode.BadRequest, {
      message: `No draft for the default locale "${draft.defaultLocale}". Either write it or change the default locale.`,
    });
  }
  const untitled: Locale[] = [];
  const translations: Partial<Record<Locale, CreateFeedTranslationInput>> = {};
  for (const locale of locales) {
    const translation = draft.translations[locale];
    if (!translation?.title?.trim()) {
      untitled.push(locale);
      continue;
    }
    translations[locale] = {
      title: translation.title,
      excerpt: translation.excerpt,
      description: translation.description,
      content: translation.content,
    };
  }
  if (untitled.length > 0) {
    throw new AppError(AppErrorCode.BadRequest, {
      message: `These locales have no title: ${untitled.join(", ")}. Every translation needs one.`,
    });
  }

  if (draft.feedId === null) {
    if (!draft.slug) {
      throw new AppError(AppErrorCode.BadRequest, {
        message:
          "A new post needs an English/ASCII slug before it can be applied.",
      });
    }
    const created = await createFeedService(
      db,
      {
        adminId,
        slug: draft.slug,
        type: draft.type,
        defaultLocale: draft.defaultLocale,
        mainImage: draft.mainImage,
        published: false,
        translations,
      },
      hooks
    );
    if (!created) {
      throw new AppError(AppErrorCode.InternalServerError, {
        message: "Creating the feed returned no row.",
      });
    }
    const commit = await commitFeedDraft(db, {
      draft,
      feedId: created.id,
      message,
    });
    return {
      feedId: created.id,
      slug: created.slug,
      created: true,
      revisionId: commit.id,
      contentHash: commit.contentHash,
    };
  }

  const updated = await updateFeedService(
    db,
    {
      feedId: draft.feedId,
      type: draft.type,
      defaultLocale: draft.defaultLocale,
      mainImage: draft.mainImage,
      translations,
    },
    hooks
  );
  const commit = await commitFeedDraft(db, {
    draft,
    feedId: updated.id,
    message,
  });
  return {
    feedId: updated.id,
    slug: updated.slug,
    created: false,
    revisionId: commit.id,
    contentHash: commit.contentHash,
  };
};

/**
 * A feed-bound draft goes back to the commit its feed holds; an unbound one is deleted, and any
 * writing session on it opens a fresh draft on its next turn. `expectedHash` is the content the
 * caller is throwing away, so work that landed since is not dropped unseen.
 */
export const discardFeedDraftService = async (
  db: DB,
  input: { draftId: number; adminId: string; expectedHash: string }
): Promise<void> => {
  const deleted = await deleteUnboundFeedDraft(db, {
    draftId: input.draftId,
    userId: input.adminId,
    expectedHash: input.expectedHash,
  });
  if (deleted.status === "deleted") return;
  if (deleted.status === "not_found") {
    throw new AppError(AppErrorCode.NotFound, {
      message: `Draft ${input.draftId} not found`,
    });
  }
  const { draft } = deleted;
  if (deleted.status === "conflict") {
    throw new AppError(AppErrorCode.Conflict, {
      message: `Draft ${draft.id} was changed by someone else; reload it and try again.`,
      data: conflictData(draft),
    });
  }
  // Bound to a post: the restore below checks the hash again under its own lock.
  if (draft.appliedRevisionId === null) {
    throw new AppError(AppErrorCode.InternalServerError, {
      message: `Draft ${draft.id} is bound to feed ${draft.feedId} without a commit.`,
    });
  }
  await restoreFeedDraftRevisionService(db, {
    draftId: draft.id,
    revisionId: draft.appliedRevisionId,
    adminId: input.adminId,
    expectedHash: input.expectedHash,
  });
};

/** Replaces the working copy with a kept state; the state it replaces is kept first. */
export const restoreFeedDraftRevisionService = async (
  db: DB,
  input: {
    draftId: number;
    revisionId: number;
    adminId: string;
    expectedHash: string;
  }
): Promise<FeedDraftRecord> => {
  // Scoped to the admin's drafts, so a revision under anyone else's draft is not found
  // whether or not it exists.
  const revision = await getFeedDraftRevision(db, {
    draftId: input.draftId,
    revisionId: input.revisionId,
    userId: input.adminId,
  });
  if (!revision) {
    throw new AppError(AppErrorCode.NotFound, {
      message: `Revision ${input.revisionId} not found`,
    });
  }
  const result = await replaceFeedDraft(db, {
    draftId: input.draftId,
    userId: input.adminId,
    expectedHash: input.expectedHash,
    snapshot: snapshotOfRevision(revision),
    author: FeedDraftAuthor.Operator,
  });
  return unwrapWrite(result, input.draftId);
};
