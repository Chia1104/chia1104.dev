import type { PostSnapshot } from "@chia/agent-content/types";
import type { DB } from "@chia/db/client";
import {
  deleteWritingAgentDrafts,
  getWritingAgentDrafts,
  getWritingAgentSession,
  updateWritingAgentSession,
  upsertWritingAgentDraft,
} from "@chia/db/repos/agent";
import type { Locale } from "@chia/db/types";
import { omitUndefined } from "@chia/utils/object";

import type { DraftStore } from "../ports.ts";
import type { DraftFeedMeta, DraftTranslation, FeedDraft } from "../types.ts";

import {
  emptyDraft,
  patchFeedMeta as mergeFeedMeta,
  patchTranslation as mergeTranslation,
} from "./operations.ts";

/**
 * {@link DraftStore} over `agent.writing_draft` (per-locale) +
 * `agent.writing_session.feedMeta` (feed-level).
 *
 * The split mirrors the real schema — `feed` vs `feed_translation` — so committing maps onto
 * `createFeedSchema` without reshaping. Both halves are jsonb rather than columns because the
 * draft is a scratch buffer: adding a field the agent can propose should not need a migration.
 */
export class PgDraftStore implements DraftStore {
  constructor(private readonly db: DB) {}

  async get(sessionId: string): Promise<FeedDraft> {
    const [writingState, rows] = await Promise.all([
      getWritingAgentSession(this.db, sessionId),
      getWritingAgentDrafts(this.db, sessionId),
    ]);

    const draft = emptyDraft();
    if (writingState?.feedMeta) {
      // SAFETY: this JSONB value is written exclusively from DraftFeedMeta in this store.
      draft.feedMeta = writingState.feedMeta as DraftFeedMeta;
    }
    if (writingState?.targetFeedId != null) {
      draft.committedFeedId = writingState.targetFeedId;
    }
    for (const row of rows) {
      draft.translations[row.locale] = {
        // SAFETY: row.meta is persisted exclusively from DraftTranslation below.
        ...(row.meta as DraftTranslation),
        content: row.content ?? undefined,
      };
    }
    return draft;
  }

  async patchFeedMeta(
    sessionId: string,
    patch: DraftFeedMeta
  ): Promise<FeedDraft> {
    // Both stores patch through `operations.ts`, which uses `mergeDefined`: an omitted field
    // arrives as an explicit `undefined` key and a plain spread would wipe it.
    const next = mergeFeedMeta(await this.get(sessionId), patch);
    await updateWritingAgentSession(this.db, sessionId, {
      feedMeta: omitUndefined(next.feedMeta),
    });
    return next;
  }

  async patchTranslation(
    sessionId: string,
    locale: Locale,
    patch: DraftTranslation
  ): Promise<FeedDraft> {
    const next = mergeTranslation(await this.get(sessionId), locale, patch);

    // `content` has its own column; everything else goes to the jsonb blob.
    const { content, ...meta } = next.translations[locale] ?? {};
    await upsertWritingAgentDraft(this.db, {
      sessionId,
      locale,
      meta: omitUndefined(meta),
      content,
    });

    return next;
  }

  setContent(
    sessionId: string,
    locale: Locale,
    content: string
  ): Promise<FeedDraft> {
    return this.patchTranslation(sessionId, locale, { content });
  }

  async markCommitted(sessionId: string, feedId: number): Promise<FeedDraft> {
    await updateWritingAgentSession(this.db, sessionId, {
      targetFeedId: feedId,
    });
    const current = await this.get(sessionId);
    return { ...current, committedFeedId: feedId };
  }

  async seedFromPost(
    sessionId: string,
    post: PostSnapshot
  ): Promise<FeedDraft> {
    await updateWritingAgentSession(this.db, sessionId, {
      targetFeedId: post.feedId,
      feedMeta: omitUndefined({
        slug: post.slug,
        type: post.type,
        contentType: post.contentType,
        defaultLocale: post.defaultLocale,
        mainImage: post.mainImage,
        tagSlugs: post.tagSlugs,
      }),
    });

    for (const translation of post.translations) {
      const { locale, content, ...meta } = translation;
      await upsertWritingAgentDraft(this.db, {
        sessionId,
        locale,
        meta: omitUndefined(meta),
        content: content ?? null,
      });
    }

    return this.get(sessionId);
  }

  /** Used when a session is reset rather than deleted. */
  async clear(sessionId: string): Promise<void> {
    await deleteWritingAgentDrafts(this.db, sessionId);
    await updateWritingAgentSession(this.db, sessionId, { feedMeta: {} });
  }
}
