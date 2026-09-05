import type { Locale } from "@chia/db/types";

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
  emptyDraft,
  patchFeedMeta,
  patchTranslation,
} from "./operations.ts";

/** In-memory {@link DraftStore} for tests and the faux provider. */
export class InMemoryDraftStore implements DraftStore {
  private readonly drafts = new Map<number, FeedDraft>();
  private readonly updatedAt = new Map<number, Date>();
  /** Simulated operator edits, each stamped with the revision it produced. */
  private readonly operatorRevisions: {
    draftId: number;
    revision: number;
    change: DraftChange;
  }[] = [];
  private nextId = 1;
  readonly observedRevisions = new Map<number, number>();

  constructor(initial: readonly Partial<FeedDraft>[] = []) {
    for (const draft of initial) this.seed(draft);
  }

  /** Adds a draft as the operator or an earlier session would have left it. */
  seed(overrides: Partial<FeedDraft> = {}): FeedDraft {
    const id = overrides.id ?? this.nextId;
    this.nextId = Math.max(this.nextId, id + 1);
    const draft = emptyDraft({ ...overrides, id });
    this.drafts.set(id, draft);
    this.updatedAt.set(id, new Date());
    return draft;
  }

  private read(draftId: number): FeedDraft {
    const draft = this.drafts.get(draftId);
    if (!draft) throw new DraftNotFoundError(draftId);
    return draft;
  }

  private observe(draft: FeedDraft): FeedDraft {
    const seen = this.observedRevisions.get(draft.id) ?? 0;
    if (draft.revision > seen)
      this.observedRevisions.set(draft.id, draft.revision);
    return draft;
  }

  private write(next: FeedDraft): FeedDraft {
    const stored = { ...next, revision: this.read(next.id).revision + 1 };
    this.drafts.set(stored.id, stored);
    this.updatedAt.set(stored.id, new Date());
    return this.observe(stored);
  }

  list(): Promise<FeedDraftSummary[]> {
    return Promise.resolve(
      [...this.drafts.values()]
        .map((draft) => draftSummary(draft, this.updatedAt.get(draft.id)!))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    );
  }

  open(input: { feedId?: number }): Promise<FeedDraft> {
    if (input.feedId !== undefined) {
      const existing = [...this.drafts.values()].find(
        (draft) => draft.feedId === input.feedId
      );
      return Promise.resolve(
        this.observe(existing ?? this.seed({ feedId: input.feedId }))
      );
    }
    return Promise.resolve(this.observe(this.seed()));
  }

  get(draftId: number): Promise<FeedDraft> {
    return Promise.resolve(this.observe(this.read(draftId)));
  }

  patchFeedMeta(draftId: number, patch: DraftFeedMeta): Promise<FeedDraft> {
    return Promise.resolve(
      this.write(patchFeedMeta(this.read(draftId), patch))
    );
  }

  patchTranslation(
    draftId: number,
    locale: Locale,
    patch: DraftTranslation
  ): Promise<FeedDraft> {
    return Promise.resolve(
      this.write(patchTranslation(this.read(draftId), locale, patch))
    );
  }

  setContent(
    draftId: number,
    locale: Locale,
    content: string,
    expectedRevision?: number
  ): Promise<FeedDraft> {
    const current = this.read(draftId);
    if (
      expectedRevision !== undefined &&
      expectedRevision !== current.revision
    ) {
      return Promise.reject(
        new DraftConflictError(expectedRevision, current.revision)
      );
    }
    return this.patchTranslation(draftId, locale, { content });
  }

  operatorChangesSince(
    draftId: number,
    afterRevision: number
  ): Promise<DraftChange[]> {
    return Promise.resolve(
      this.operatorRevisions
        .filter(
          (entry) => entry.draftId === draftId && entry.revision > afterRevision
        )
        .map((entry) => entry.change)
    );
  }

  /** Applies an edit as the operator would from the dashboard: bumps the revision and leaves a change record. */
  operatorEdit(
    draftId: number,
    locale: Locale,
    patch: DraftTranslation
  ): FeedDraft {
    const next = this.write(
      patchTranslation(this.read(draftId), locale, patch)
    );
    this.operatorRevisions.push({
      draftId,
      revision: next.revision,
      change: { locale, fields: Object.keys(patch) },
    });
    // The store did not "see" this write on the agent's behalf.
    this.observedRevisions.set(draftId, next.revision - 1);
    return next;
  }

  /** Marks the draft as applied to a feed, as `applyDraft` does server-side. */
  bindFeed(draftId: number, feedId: number): void {
    this.drafts.set(draftId, { ...this.read(draftId), feedId });
  }

  /** Removes the draft, as the operator's discard does. */
  discard(draftId: number): void {
    this.drafts.delete(draftId);
    this.updatedAt.delete(draftId);
  }
}
