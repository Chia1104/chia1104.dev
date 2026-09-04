import type { Locale } from "@chia/db/types";

import type { DraftStore } from "../ports.ts";
import type {
  DraftChange,
  DraftFeedMeta,
  DraftTranslation,
  FeedDraft,
} from "../types.ts";

import {
  DraftConflictError,
  emptyDraft,
  patchFeedMeta,
  patchTranslation,
} from "./operations.ts";

/** In-memory {@link DraftStore} for tests and the faux provider. */
export class InMemoryDraftStore implements DraftStore {
  private draft: FeedDraft;
  /** Simulated operator edits, each stamped with the revision it produced. */
  private readonly operatorRevisions: {
    revision: number;
    change: DraftChange;
  }[] = [];
  lastObservedRevision = 0;

  constructor(initial: Partial<FeedDraft> = {}) {
    this.draft = emptyDraft({ id: 1, ...initial });
  }

  private observe(): FeedDraft {
    this.lastObservedRevision = Math.max(
      this.lastObservedRevision,
      this.draft.revision
    );
    return this.draft;
  }

  private write(next: FeedDraft): FeedDraft {
    this.draft = { ...next, revision: this.draft.revision + 1 };
    return this.observe();
  }

  get(): Promise<FeedDraft> {
    return Promise.resolve(this.observe());
  }

  patchFeedMeta(patch: DraftFeedMeta): Promise<FeedDraft> {
    return Promise.resolve(this.write(patchFeedMeta(this.draft, patch)));
  }

  patchTranslation(
    locale: Locale,
    patch: DraftTranslation
  ): Promise<FeedDraft> {
    return Promise.resolve(
      this.write(patchTranslation(this.draft, locale, patch))
    );
  }

  setContent(
    locale: Locale,
    content: string,
    expectedRevision?: number
  ): Promise<FeedDraft> {
    if (
      expectedRevision !== undefined &&
      expectedRevision !== this.draft.revision
    ) {
      return Promise.reject(
        new DraftConflictError(expectedRevision, this.draft.revision)
      );
    }
    return this.patchTranslation(locale, { content });
  }

  operatorChangesSince(afterRevision: number): Promise<DraftChange[]> {
    return Promise.resolve(
      this.operatorRevisions
        .filter((entry) => entry.revision > afterRevision)
        .map((entry) => entry.change)
    );
  }

  /** Applies an edit as the operator would from the dashboard: bumps the revision and leaves a change record. */
  operatorEdit(locale: Locale, patch: DraftTranslation): FeedDraft {
    const next = this.write(patchTranslation(this.draft, locale, patch));
    this.operatorRevisions.push({
      revision: next.revision,
      change: { locale, fields: Object.keys(patch) },
    });
    // The store did not "see" this write on the agent's behalf.
    this.lastObservedRevision = next.revision - 1;
    return next;
  }

  /** Marks the draft as applied to a feed, as `applyDraft` does server-side. */
  bindFeed(feedId: number): void {
    this.draft = { ...this.draft, feedId };
  }
}
