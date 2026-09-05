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
  FeedDraftSummary,
} from "../types.ts";

import {
  DraftConflictError,
  DraftNotFoundError,
  draftSummary,
} from "./operations.ts";

export interface PgDraftStoreOptions {
  /** Recorded as the author of every revision this store writes. */
  sessionId: string;
  /** Get-or-create as the host does it, so the agent and the editor share one draft per feed. */
  open(input: { feedId?: number }): Promise<FeedDraftRecord>;
  /** The author's drafts with unapplied work, newest first. */
  list(): Promise<FeedDraftRecord[]>;
}

/** {@link DraftStore} over the shared `feed_draft` rows, writing as the agent. */
export class PgDraftStore implements DraftStore {
  readonly observedRevisions = new Map<number, number>();

  constructor(
    private readonly db: DB,
    private readonly options: PgDraftStoreOptions
  ) {}

  private observe(record: FeedDraftRecord): FeedDraft {
    const seen = this.observedRevisions.get(record.id) ?? 0;
    if (record.revision > seen) {
      this.observedRevisions.set(record.id, record.revision);
    }
    return toFeedDraft(record);
  }

  private settle(
    draftId: number,
    result: FeedDraftWriteResult,
    expectedRevision?: number
  ) {
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
        throw new DraftNotFoundError(draftId);
    }
  }

  async list(): Promise<FeedDraftSummary[]> {
    const records = await this.options.list();
    return records.map((record) =>
      draftSummary(this.observe(record), record.updatedAt)
    );
  }

  async open(input: { feedId?: number }): Promise<FeedDraft> {
    return this.observe(await this.options.open(input));
  }

  async get(draftId: number): Promise<FeedDraft> {
    const record = await getFeedDraft(this.db, draftId);
    if (!record) throw new DraftNotFoundError(draftId);
    return this.observe(record);
  }

  async patchFeedMeta(
    draftId: number,
    patch: DraftFeedMeta
  ): Promise<FeedDraft> {
    return this.settle(
      draftId,
      await patchFeedDraft(this.db, {
        draftId,
        author: FEED_DRAFT_AUTHOR.Agent,
        sessionId: this.options.sessionId,
        meta: omitUndefined(patch),
      })
    );
  }

  async patchTranslation(
    draftId: number,
    locale: Locale,
    patch: DraftTranslation
  ): Promise<FeedDraft> {
    return this.settle(
      draftId,
      await patchFeedDraft(this.db, {
        draftId,
        author: FEED_DRAFT_AUTHOR.Agent,
        sessionId: this.options.sessionId,
        translations: { [locale]: omitUndefined(patch) },
      })
    );
  }

  async setContent(
    draftId: number,
    locale: Locale,
    content: string,
    expectedRevision?: number
  ): Promise<FeedDraft> {
    return this.settle(
      draftId,
      await patchFeedDraft(this.db, {
        draftId,
        expectedRevision,
        author: FEED_DRAFT_AUTHOR.Agent,
        sessionId: this.options.sessionId,
        translations: { [locale]: { content } },
      }),
      expectedRevision
    );
  }

  operatorChangesSince(
    draftId: number,
    afterRevision: number
  ): Promise<DraftChange[]> {
    return listOperatorFeedDraftChanges(this.db, { draftId, afterRevision });
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
