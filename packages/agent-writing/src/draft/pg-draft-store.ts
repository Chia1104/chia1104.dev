import type { DB } from "@chia/db/client";
import {
  editFeedDraftContent,
  getFeedDraft,
  listOperatorFeedDraftChanges,
  patchFeedDraft,
} from "@chia/db/repos/drafts";
import type {
  FeedDraftListItem,
  FeedDraftRecord,
  FeedDraftWriteResult,
  PatchFeedDraftInput,
} from "@chia/db/repos/drafts";
import { FEED_DRAFT_AUTHOR } from "@chia/db/schema";
import type { Locale } from "@chia/db/types";
import { omitUndefined } from "@chia/utils/object";

import type { DraftStore } from "../ports.ts";
import type {
  DraftChange,
  DraftContentEdit,
  DraftEditResult,
  DraftWrite,
  FeedDraft,
  FeedDraftSummary,
} from "../types.ts";

import {
  DraftConflictError,
  DraftNotFoundError,
  EditNotAppliedError,
  describeEdits,
  draftSummary,
  noBodyMessage,
} from "./operations.ts";

export interface PgDraftStoreOptions {
  /** Recorded as the author of every revision this store writes. */
  sessionId: string;
  /** The drafts' owner; a write to anyone else's draft reads as not found. */
  userId: string;
  /** Get-or-create as the host does it, so the agent and the editor share one draft per feed. */
  open(input: { feedId?: number }): Promise<FeedDraftRecord>;
  /** The author's drafts with unapplied work, newest first. */
  list(): Promise<FeedDraftListItem[]>;
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
    return records.map((record) => draftSummary(record, record.updatedAt));
  }

  async open(input: { feedId?: number }): Promise<FeedDraft> {
    return this.observe(await this.options.open(input));
  }

  async get(draftId: number): Promise<FeedDraft> {
    const record = await getFeedDraft(this.db, draftId, this.options.userId);
    if (!record) throw new DraftNotFoundError(draftId);
    return this.observe(record);
  }

  async write(
    draftId: number,
    input: DraftWrite,
    expectedRevision?: number
  ): Promise<FeedDraft> {
    const translations: PatchFeedDraftInput["translations"] = {};
    for (const [locale, patch] of Object.entries(input.translations ?? {})) {
      if (!patch) continue;
      // SAFETY: DraftWrite.translations is keyed by Locale.
      translations[locale as Locale] = omitUndefined(patch);
    }
    return this.settle(
      draftId,
      await patchFeedDraft(this.db, {
        draftId,
        userId: this.options.userId,
        expectedRevision,
        author: FEED_DRAFT_AUTHOR.Agent,
        sessionId: this.options.sessionId,
        meta: input.meta ? omitUndefined(input.meta) : undefined,
        translations,
      }),
      expectedRevision
    );
  }

  async editContent(
    draftId: number,
    locale: Locale,
    edits: readonly DraftContentEdit[]
  ): Promise<DraftEditResult> {
    const result = await editFeedDraftContent(this.db, {
      draftId,
      userId: this.options.userId,
      locale,
      edits,
      author: FEED_DRAFT_AUTHOR.Agent,
      sessionId: this.options.sessionId,
    });
    switch (result.status) {
      case "ok": {
        const draft = this.observe(result.draft);
        return {
          draft,
          edits: describeEdits(
            draft.translations[locale]?.content ?? "",
            result.edits
          ),
        };
      }
      case "no_body":
        throw new EditNotAppliedError(noBodyMessage(locale), "no_body");
      case "not_applied":
        throw new EditNotAppliedError(
          `Edit ${result.index + 1} of ${edits.length} was not applied, so nothing was written. ${result.message}`,
          result.reason
        );
      default:
        return { draft: this.settle(draftId, result), edits: [] };
    }
  }

  operatorChangesSince(
    draftId: number,
    afterRevision: number
  ): Promise<DraftChange[]> {
    return listOperatorFeedDraftChanges(this.db, {
      draftId,
      afterRevision,
      userId: this.options.userId,
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
