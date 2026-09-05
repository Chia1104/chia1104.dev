import type { DB } from "@chia/db/client";
import {
  createFeedDraft,
  deleteFeedDraft,
  getFeedDraft,
  getFeedDraftByFeedId,
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
  await requireDraft(db, input.draftId, input.adminId);

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
    expectedRevision: input.expectedRevision,
    author: input.author,
    sessionId: input.sessionId,
    meta,
    translations: input.translations,
  });
  return unwrapWrite(result, input.draftId);
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
 */
export const applyFeedDraftService = async (
  db: DB,
  input: { draftId: number; adminId: string },
  hooks: FeedHooks
): Promise<ApplyFeedDraftResult> => {
  const draft = await requireDraft(db, input.draftId, input.adminId);
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
        adminId: input.adminId,
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
  await requireDraft(db, input.draftId, input.adminId);
  const revision = await getFeedDraftRevision(db, {
    draftId: input.draftId,
    revisionId: input.revisionId,
  });
  if (!revision) {
    throw new AppError("NOT_FOUND", {
      message: `Revision ${input.revisionId} not found`,
    });
  }
  const result = await replaceFeedDraft(db, {
    draftId: input.draftId,
    snapshot: snapshotOfRevision(revision),
    author: FEED_DRAFT_AUTHOR.Operator,
  });
  return unwrapWrite(result, input.draftId);
};
