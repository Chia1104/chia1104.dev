import type { DB } from "@chia/db/client";
import {
  editFeedDraftContent,
  getFeedDraft,
  listFeedDraftChangesSince,
  patchFeedDraft,
} from "@chia/db/repos/drafts";
import type { FeedDraftListItem, FeedDraftRecord } from "@chia/db/repos/drafts";
import { FeedDraftAuthor } from "@chia/db/schema";
import type { Locale } from "@chia/db/types";

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
  ObservedDrafts,
  describeEdits,
  draftSummary,
  noBodyMessage,
  toDraftFields,
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
  private readonly observed = new ObservedDrafts();

  constructor(
    private readonly db: DB,
    private readonly options: PgDraftStoreOptions
  ) {}

  get observedRevisions(): ReadonlyMap<number, number> {
    return this.observed.revisions;
  }

  async list(): Promise<FeedDraftSummary[]> {
    const records = await this.options.list();
    return records.map((record) => draftSummary(record, record.updatedAt));
  }

  async open(input: { feedId?: number }): Promise<FeedDraft> {
    return this.observed.read(toFeedDraft(await this.options.open(input)));
  }

  async get(draftId: number): Promise<FeedDraft> {
    const record = await getFeedDraft(this.db, draftId, this.options.userId);
    if (!record) throw new DraftNotFoundError(draftId);
    return this.observed.read(toFeedDraft(record));
  }

  async write(draftId: number, input: DraftWrite): Promise<FeedDraft> {
    // A draft never read is read now, so the write is still checked against something.
    if (!this.observed.has(draftId)) await this.get(draftId);
    const result = await patchFeedDraft(this.db, {
      draftId,
      userId: this.options.userId,
      author: FeedDraftAuthor.Agent,
      sessionId: this.options.sessionId,
      ...toDraftFields(input),
      base: toDraftFields(this.observed.baseOf(draftId, input) ?? {}),
    });
    switch (result.status) {
      case "ok":
        return this.observed.wrote(toFeedDraft(result.draft), input);
      case "conflict":
        throw new DraftConflictError(
          (result.rejected ?? []).map(({ locale, field }) =>
            locale ? `${locale}.${field}` : field
          )
        );
      case "not_found":
        throw new DraftNotFoundError(draftId);
    }
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
      author: FeedDraftAuthor.Agent,
      sessionId: this.options.sessionId,
    });
    switch (result.status) {
      case "ok": {
        const draft = this.observed.edited(
          toFeedDraft(result.draft),
          locale,
          edits
        );
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
      case "conflict":
        throw new DraftConflictError([`${locale}.content`]);
      case "not_found":
        throw new DraftNotFoundError(draftId);
    }
  }

  operatorChangesSince(
    draftId: number,
    afterRevision: number
  ): Promise<DraftChange[]> {
    return listFeedDraftChangesSince(this.db, {
      draftId,
      afterRevision,
      userId: this.options.userId,
      exceptSessionId: this.options.sessionId,
    });
  }
}

export const toFeedDraft = (record: FeedDraftRecord): FeedDraft => ({
  id: record.id,
  feedId: record.feedId,
  revision: record.revision,
  contentHash: record.contentHash,
  slug: record.slug,
  type: record.type,
  defaultLocale: record.defaultLocale,
  mainImage: record.mainImage,
  translations: record.translations,
});
