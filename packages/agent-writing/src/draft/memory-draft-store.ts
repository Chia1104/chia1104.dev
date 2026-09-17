import { settleFeedDraftPatch } from "@chia/db/repos/drafts/patch";
import type { Locale } from "@chia/db/types";
import { applyEdits } from "@chia/utils/text";

import type { DraftStore } from "../ports.ts";
import type {
  DraftChange,
  DraftContentEdit,
  DraftEditResult,
  DraftFeedMeta,
  DraftTranslation,
  DraftWrite,
  FeedDraft,
  FeedDraftSummary,
} from "../types.ts";

import {
  DraftConflictError,
  DraftNotFoundError,
  EditNotAppliedError,
  ObservedDrafts,
  applyWrite,
  describeEdits,
  draftSummary,
  emptyDraft,
  hashDraft,
  noBodyMessage,
  patchTranslation,
  snapshotOfDraft,
  toDraftFields,
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
  private readonly observed = new ObservedDrafts();

  get observedRevisions(): ReadonlyMap<number, number> {
    return this.observed.revisions;
  }

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

  private write_(next: FeedDraft): FeedDraft {
    const stored = {
      ...next,
      revision: this.read(next.id).revision + 1,
      contentHash: hashDraft(next),
    };
    this.drafts.set(stored.id, stored);
    this.updatedAt.set(stored.id, new Date());
    return stored;
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
        this.observed.read(existing ?? this.seed({ feedId: input.feedId }))
      );
    }
    return Promise.resolve(this.observed.read(this.seed()));
  }

  get(draftId: number): Promise<FeedDraft> {
    return Promise.resolve(this.observed.read(this.read(draftId)));
  }

  async write(draftId: number, input: DraftWrite): Promise<FeedDraft> {
    if (!this.observed.has(draftId)) await this.get(draftId);
    const current = this.read(draftId);
    const settled = settleFeedDraftPatch(snapshotOfDraft(current), {
      ...toDraftFields(input),
      base: toDraftFields(this.observed.baseOf(draftId, input) ?? {}),
    });
    if (!settled.ok) {
      throw new DraftConflictError(
        settled.rejected.map(({ locale, field }) =>
          locale ? `${locale}.${field}` : field
        )
      );
    }
    return this.observed.wrote(this.write_(applyWrite(current, input)), input);
  }

  /** Test shorthand for `write` on one locale. */
  patchTranslation(
    draftId: number,
    locale: Locale,
    patch: DraftTranslation
  ): Promise<FeedDraft> {
    return this.write(draftId, { translations: { [locale]: patch } });
  }

  /** Test shorthand for `write` on feed-level fields. */
  patchFeedMeta(draftId: number, patch: DraftFeedMeta): Promise<FeedDraft> {
    return this.write(draftId, { meta: patch });
  }

  async editContent(
    draftId: number,
    locale: Locale,
    edits: readonly DraftContentEdit[]
  ): Promise<DraftEditResult> {
    const current = this.read(draftId);
    const body = current.translations[locale]?.content;
    if (body === undefined || body === null) {
      throw new EditNotAppliedError(noBodyMessage(locale), "no_body");
    }
    const applied = applyEdits(body, edits);
    if (!applied.ok) {
      throw new EditNotAppliedError(
        `Edit ${applied.index + 1} of ${edits.length} was not applied, so nothing was written. ${applied.message}`,
        applied.reason
      );
    }
    // Matched against the body as it is, so it needs no check against what the model saw.
    const draft = this.observed.edited(
      this.write_(
        patchTranslation(current, locale, { content: applied.content })
      ),
      locale,
      edits
    );
    return { draft, edits: describeEdits(applied.content, applied.edits) };
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
    const next = this.write_(
      patchTranslation(this.read(draftId), locale, patch)
    );
    this.operatorRevisions.push({
      draftId,
      revision: next.revision,
      change: { locale, fields: Object.keys(patch) },
    });
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
