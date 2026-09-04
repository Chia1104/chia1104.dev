import type { DB } from "@chia/db/client";
import {
  getFeedDraft,
  listOperatorFeedDraftChanges,
  patchFeedDraft,
} from "@chia/db/repos/drafts";
import type {
  FeedDraftRecord,
  FeedDraftWriteResult,
} from "@chia/db/repos/drafts";
import { FEED_DRAFT_AUTHOR } from "@chia/db/schema";
import type { Locale } from "@chia/db/types";
import { omitUndefined } from "@chia/utils/object";

import type { DraftStore } from "../ports.ts";
import type {
  DraftChange,
  DraftFeedMeta,
  DraftTranslation,
  FeedDraft,
} from "../types.ts";

import { DraftConflictError } from "./operations.ts";

export interface PgDraftStoreOptions {
  draftId: number;
  /** Recorded as the author of every revision this store writes. */
  sessionId: string;
}

/** {@link DraftStore} over the shared `feed_draft` row, writing as the agent. */
export class PgDraftStore implements DraftStore {
  lastObservedRevision = 0;

  constructor(
    private readonly db: DB,
    private readonly options: PgDraftStoreOptions
  ) {}

  private observe(record: FeedDraftRecord): FeedDraft {
    this.lastObservedRevision = Math.max(
      this.lastObservedRevision,
      record.revision
    );
    return toFeedDraft(record);
  }

  private settle(result: FeedDraftWriteResult, expectedRevision?: number) {
    switch (result.status) {
      case "ok":
        return this.observe(result.draft);
      case "conflict":
        this.observe(result.draft);
        throw new DraftConflictError(
          expectedRevision ?? result.draft.revision,
          result.draft.revision
        );
      case "not_found":
        throw new Error(
          `Draft ${this.options.draftId} no longer exists; the operator discarded it.`
        );
    }
  }

  async get(): Promise<FeedDraft> {
    const record = await getFeedDraft(this.db, this.options.draftId);
    if (!record) {
      throw new Error(
        `Draft ${this.options.draftId} no longer exists; the operator discarded it.`
      );
    }
    return this.observe(record);
  }

  async patchFeedMeta(patch: DraftFeedMeta): Promise<FeedDraft> {
    return this.settle(
      await patchFeedDraft(this.db, {
        draftId: this.options.draftId,
        author: FEED_DRAFT_AUTHOR.Agent,
        sessionId: this.options.sessionId,
        meta: omitUndefined(patch),
      })
    );
  }

  async patchTranslation(
    locale: Locale,
    patch: DraftTranslation
  ): Promise<FeedDraft> {
    return this.settle(
      await patchFeedDraft(this.db, {
        draftId: this.options.draftId,
        author: FEED_DRAFT_AUTHOR.Agent,
        sessionId: this.options.sessionId,
        translations: { [locale]: omitUndefined(patch) },
      })
    );
  }

  async setContent(
    locale: Locale,
    content: string,
    expectedRevision?: number
  ): Promise<FeedDraft> {
    return this.settle(
      await patchFeedDraft(this.db, {
        draftId: this.options.draftId,
        expectedRevision,
        author: FEED_DRAFT_AUTHOR.Agent,
        sessionId: this.options.sessionId,
        translations: { [locale]: { content } },
      }),
      expectedRevision
    );
  }

  operatorChangesSince(afterRevision: number): Promise<DraftChange[]> {
    return listOperatorFeedDraftChanges(this.db, {
      draftId: this.options.draftId,
      afterRevision,
    });
  }
}

export const toFeedDraft = (record: FeedDraftRecord): FeedDraft => ({
  id: record.id,
  feedId: record.feedId,
  revision: record.revision,
  slug: record.slug,
  type: record.type,
  defaultLocale: record.defaultLocale,
  mainImage: record.mainImage,
  translations: record.translations,
});
