import type { DB } from "@chia/db/client";
import {
  createFeedDraft,
  deleteFeedDraft,
  editFeedDraftContent,
  getFeedDraft,
  getFeedDraftByFeedId,
  getFeedDraftForUpdate,
  getFeedDraftRevision,
  markFeedDraftApplied,
  patchFeedDraft,
  replaceFeedDraft,
  snapshotOfRevision,
} from "@chia/db/repos/drafts";
import type {
  FeedDraftMetaPatch,
  FeedDraftRecord,
  FeedDraftSnapshot,
  FeedDraftTranslationPatch,
  FeedDraftWriter,
} from "@chia/db/repos/drafts";
import { getFeedForIndexing } from "@chia/db/repos/feeds";
import { FEED_DRAFT_AUTHOR } from "@chia/db/schema";
import type { Locale } from "@chia/db/types";
import { AppError } from "@chia/service-kit/errors";
import { normalizeAsciiSlug } from "@chia/utils/slug";

import type { FeedHooks } from "../orpc/utils";

import { createFeedService, updateFeedService } from "./write";

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
  const draft = await getFeedDraft(db, draftId);
  if (!draft || draft.userId !== adminId) {
    throw new AppError("NOT_FOUND", {
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
    throw new AppError("NOT_FOUND", { message: `Feed ${feedId} not found` });
  }
  const translations: FeedDraftSnapshot["translations"] = {};
  for (const translation of feed.translations) {
    translations[translation.locale] = {
      title: translation.title,
      excerpt: translation.excerpt,
      description: translation.description,
      summary: translation.summary,
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
      throw new AppError("NOT_FOUND", {
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

export interface PatchFeedDraftServiceInput extends FeedDraftWriter {
  draftId: number;
  adminId: string;
  expectedRevision?: number;
  meta?: FeedDraftMetaPatch;
  translations?: Partial<Record<Locale, FeedDraftTranslationPatch>>;
}

/**
 * Throws `CONFLICT` with the current draft in `data` when `expectedRevision` is stale, so the
 * caller can rebase without another round trip.
 */
export const patchFeedDraftService = async (
  db: DB,
  input: PatchFeedDraftServiceInput
): Promise<FeedDraftRecord> => {
  const meta = { ...input.meta };
  if (meta.slug !== undefined && meta.slug !== null) {
    const slug = normalizeAsciiSlug(meta.slug);
    if (!slug) {
      throw new AppError("BAD_REQUEST", {
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
  });
  return unwrapWrite(result, input.draftId);
};

export interface EditFeedDraftContentServiceInput extends FeedDraftWriter {
  draftId: number;
  adminId: string;
  locale: Locale;
  oldString: string;
  newString: string;
  replaceAll?: boolean;
  expectedRevision?: number;
}

export interface EditFeedDraftContentResult {
  draft: FeedDraftRecord;
  replacements: number;
}

/** A target that does not match exactly once is `BAD_REQUEST`; the message says how to fix the call. */
export const editFeedDraftContentService = async (
  db: DB,
  input: EditFeedDraftContentServiceInput
): Promise<EditFeedDraftContentResult> => {
  const result = await editFeedDraftContent(db, {
    draftId: input.draftId,
    userId: input.adminId,
    locale: input.locale,
    oldString: input.oldString,
    newString: input.newString,
    replaceAll: input.replaceAll,
    expectedRevision: input.expectedRevision,
    author: input.author,
    sessionId: input.sessionId,
  });
  switch (result.status) {
    case "ok":
      return { draft: result.draft, replacements: result.replacements };
    case "no_body":
      throw new AppError("BAD_REQUEST", {
        message: `Draft ${input.draftId} has no "${input.locale}" body yet; write one before editing it.`,
      });
    case "not_applied":
      throw new AppError("BAD_REQUEST", {
        message: result.message,
        data: { reason: result.reason },
      });
    default:
      return { draft: unwrapWrite(result, input.draftId), replacements: 0 };
  }
};

const unwrapWrite = (
  result: Awaited<ReturnType<typeof patchFeedDraft>>,
  draftId: number
): FeedDraftRecord => {
  switch (result.status) {
    case "ok":
      return result.draft;
    case "conflict":
      throw new AppError("CONFLICT", {
        message: `Draft ${draftId} was changed by someone else; reload it and try again.`,
        data: { revision: result.draft.revision },
      });
    case "not_found":
      throw new AppError("NOT_FOUND", {
        message: `Draft ${draftId} not found`,
      });
  }
};

export interface ApplyFeedDraftResult {
  feedId: number;
  slug: string;
  created: boolean;
}

/**
 * Writes the draft onto `feed` and `feed_translation`, creating an unpublished feed the first
 * time. Publishing is a separate feed write. The draft stays open as the working copy.
 *
 * With `expectedRevision`, the draft row is locked and its revision checked in the same
 * transaction that writes the feed, so what lands is the revision the caller approved and
 * nothing written since. Feed hooks run after that transaction commits.
 */
export const applyFeedDraftService = async (
  db: DB,
  input: { draftId: number; adminId: string; expectedRevision?: number },
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
      throw new AppError("NOT_FOUND", {
        message: `Draft ${input.draftId} not found`,
      });
    }
    if (
      input.expectedRevision !== undefined &&
      locked.revision !== input.expectedRevision
    ) {
      throw new AppError("CONFLICT", {
        message: `Draft ${input.draftId} is at revision ${locked.revision}, not ${input.expectedRevision}: it changed after it was approved. Read it again and ask for approval of the current revision.`,
        data: { revision: locked.revision },
      });
    }
    return applyLockedDraft(tx, locked, input.adminId, deferred);
  });
  // The feed is committed; a hook that cannot start indexing does not unmake that, so the
  // caller hears the truth and the index catches up on the next apply or publish.
  for (const feedID of changed) {
    try {
      await hooks.onFeedChanged?.(feedID);
    } catch (error) {
      console.error("Feed change hook failed after the draft was applied", {
        draftId: input.draftId,
        feedID,
        cause: error,
      });
    }
  }
  return result;
};

const applyLockedDraft = async (
  db: DB,
  draft: FeedDraftRecord,
  adminId: string,
  hooks: FeedHooks
): Promise<ApplyFeedDraftResult> => {
  // SAFETY: translations are keyed by Locale.
  const locales = Object.keys(draft.translations) as Locale[];

  if (locales.length === 0) {
    throw new AppError("BAD_REQUEST", {
      message: "The draft is empty. Write at least one locale before applying.",
    });
  }
  if (!draft.translations[draft.defaultLocale]) {
    throw new AppError("BAD_REQUEST", {
      message: `No draft for the default locale "${draft.defaultLocale}". Either write it or change the default locale.`,
    });
  }
  const untitled = locales.filter(
    (locale) => !draft.translations[locale]?.title?.trim()
  );
  if (untitled.length > 0) {
    throw new AppError("BAD_REQUEST", {
      message: `These locales have no title: ${untitled.join(", ")}. Every translation needs one.`,
    });
  }

  const translations: Record<
    string,
    {
      title: string;
      excerpt: string | null;
      description: string | null;
      summary: string | null;
      content: string | null;
    }
  > = {};
  for (const locale of locales) {
    const translation = draft.translations[locale]!;
    translations[locale] = {
      title: translation.title!,
      excerpt: translation.excerpt,
      description: translation.description,
      summary: translation.summary,
      content: translation.content,
    };
  }

  if (draft.feedId === null) {
    if (!draft.slug) {
      throw new AppError("BAD_REQUEST", {
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
      throw new AppError("INTERNAL_SERVER_ERROR", {
        message: "Creating the feed returned no row.",
      });
    }
    await markFeedDraftApplied(db, {
      draftId: draft.id,
      feedId: created.id,
      revision: draft.revision,
    });
    return { feedId: created.id, slug: created.slug, created: true };
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
  await markFeedDraftApplied(db, {
    draftId: draft.id,
    feedId: updated.id,
    revision: draft.revision,
  });
  return { feedId: updated.id, slug: updated.slug, created: false };
};

/**
 * A feed-bound draft goes back to what the feed holds; an unbound one is deleted, and any
 * writing session on it opens a fresh draft on its next turn.
 */
export const discardFeedDraftService = async (
  db: DB,
  input: { draftId: number; adminId: string }
): Promise<void> => {
  const draft = await requireDraft(db, input.draftId, input.adminId);
  if (draft.feedId === null) {
    await deleteFeedDraft(db, draft.id);
    return;
  }
  const result = await replaceFeedDraft(db, {
    draftId: draft.id,
    userId: input.adminId,
    snapshot: await feedSnapshot(db, draft.feedId, input.adminId),
    author: FEED_DRAFT_AUTHOR.Operator,
  });
  const reset = unwrapWrite(result, draft.id);
  await markFeedDraftApplied(db, {
    draftId: draft.id,
    feedId: draft.feedId,
    revision: reset.revision,
  });
};

export const restoreFeedDraftRevisionService = async (
  db: DB,
  input: { draftId: number; revisionId: number; adminId: string }
): Promise<FeedDraftRecord> => {
  // Scoped to the admin's drafts, so a revision under anyone else's draft is not found
  // whether or not it exists.
  const revision = await getFeedDraftRevision(db, {
    draftId: input.draftId,
    revisionId: input.revisionId,
    userId: input.adminId,
  });
  if (!revision) {
    throw new AppError("NOT_FOUND", {
      message: `Revision ${input.revisionId} not found`,
    });
  }
  const result = await replaceFeedDraft(db, {
    draftId: input.draftId,
    userId: input.adminId,
    snapshot: snapshotOfRevision(revision),
    author: FEED_DRAFT_AUTHOR.Operator,
  });
  return unwrapWrite(result, input.draftId);
};
