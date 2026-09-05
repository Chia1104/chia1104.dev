import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DB } from "@chia/db/client";
import type {
  FeedDraftRecord,
  PatchFeedDraftInput,
} from "@chia/db/repos/drafts";
import type { Locale } from "@chia/db/types";

/**
 * Fakes the drafts repo with the same write semantics as the real one: `undefined` leaves a
 * field alone, `null` clears it, every write bumps `revision`, and a stale
 * `expectedRevision` is refused with the current row.
 */
const now = new Date("2026-09-04T00:00:00Z");
let drafts: Map<number, FeedDraftRecord>;
const record = (id: number, feedId: number | null = null): FeedDraftRecord => ({
  id,
  feedId,
  userId: "author",
  slug: null,
  type: "post",
  defaultLocale: "zh-TW",
  mainImage: null,
  revision: 1,
  appliedRevision: null,
  createdAt: now,
  updatedAt: now,
  translations: {},
});
const reset = () => {
  drafts = new Map([[7, record(7)]]);
};
reset();

const defined = <T extends object>(patch: T) =>
  Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined)
  );

vi.mock("@chia/db/repos/drafts", () => ({
  getFeedDraft: vi.fn(async (_db: DB, draftId: number) => {
    const draft = drafts.get(draftId);
    return draft ? { ...draft } : null;
  }),
  listOperatorFeedDraftChanges: vi.fn(async () => []),
  patchFeedDraft: vi.fn(async (_db: DB, input: PatchFeedDraftInput) => {
    const draft = drafts.get(input.draftId);
    if (!draft) return { status: "not_found" };
    if (
      input.expectedRevision !== undefined &&
      input.expectedRevision !== draft.revision
    ) {
      return { status: "conflict", draft: { ...draft } };
    }
    const translations = { ...draft.translations };
    for (const [locale, patch] of Object.entries(input.translations ?? {})) {
      // SAFETY: the store only ever keys translations by Locale.
      const key = locale as Locale;
      translations[key] = {
        title: null,
        excerpt: null,
        description: null,
        summary: null,
        content: null,
        ...translations[key],
        ...defined(patch ?? {}),
      };
    }
    const next = {
      ...draft,
      ...defined(input.meta ?? {}),
      translations,
      revision: draft.revision + 1,
    };
    drafts.set(input.draftId, next);
    return { status: "ok", draft: { ...next } };
  }),
}));

const { PgDraftStore } = await import("../src/draft/pg-draft-store.ts");
const { DraftConflictError, DraftNotFoundError } =
  await import("../src/draft/operations.ts");

// SAFETY: every repo function is mocked above and never touches the handle.
const db = {} as DB;
const DRAFT_ID = 7;

const build = () =>
  new PgDraftStore(db, {
    sessionId: "session-1",
    list: async () => [...drafts.values()],
    open: async ({ feedId }) => {
      const existing = [...drafts.values()].find(
        (draft) => feedId !== undefined && draft.feedId === feedId
      );
      if (existing) return existing;
      const created = record(drafts.size + 100, feedId ?? null);
      drafts.set(created.id, created);
      return created;
    },
  });

describe("PgDraftStore", () => {
  beforeEach(reset);

  it("leaves omitted per-locale fields alone when the patch carries explicit undefined keys", async () => {
    const store = build();
    await store.patchTranslation(DRAFT_ID, "en", {
      title: "Title",
      excerpt: "Excerpt",
      description: "Description",
      summary: "Summary",
    });

    // Exactly what `patch_draft_meta` sends: every per-locale key present, most undefined.
    const next = await store.patchTranslation(DRAFT_ID, "en", {
      title: "New title",
      excerpt: undefined,
      description: undefined,
      summary: undefined,
    });

    expect(next.translations.en).toMatchObject({
      title: "New title",
      excerpt: "Excerpt",
      description: "Description",
      summary: "Summary",
    });
  });

  it("clears a field on null and keeps the body across metadata patches", async () => {
    const store = build();
    await store.setContent(DRAFT_ID, "en", "## Body");
    await store.patchTranslation(DRAFT_ID, "en", { title: "T", excerpt: "E" });
    const next = await store.patchTranslation(DRAFT_ID, "en", {
      excerpt: null,
    });

    expect(next.translations.en?.excerpt).toBeNull();
    expect(next.translations.en?.title).toBe("T");
    expect(next.translations.en?.content).toBe("## Body");
  });

  it("merges feed-level metadata the same way", async () => {
    const store = build();
    await store.patchFeedMeta(DRAFT_ID, { slug: "a-slug", type: "post" });
    const next = await store.patchFeedMeta(DRAFT_ID, {
      slug: undefined,
      type: undefined,
      defaultLocale: "en",
    });

    expect(next).toMatchObject({
      slug: "a-slug",
      type: "post",
      defaultLocale: "en",
    });
  });

  it("refuses a body write pinned to a revision the draft has moved past", async () => {
    const store = build();
    const read = await store.get(DRAFT_ID);
    const current = drafts.get(DRAFT_ID);
    if (!current) throw new Error("fixture draft missing");
    drafts.set(DRAFT_ID, { ...current, revision: read.revision + 1 });

    await expect(
      store.setContent(DRAFT_ID, "en", "## Stale", read.revision)
    ).rejects.toBeInstanceOf(DraftConflictError);
    // The conflict response still tells the store where the draft is now.
    expect(store.observedRevisions.get(DRAFT_ID)).toBe(read.revision + 1);
  });

  it("tracks the revision it saw per draft and names a draft that is gone", async () => {
    const store = build();
    const opened = await store.open({ feedId: 42 });
    await store.setContent(opened.id, "en", "## Body");
    await store.get(DRAFT_ID);

    expect([...store.observedRevisions]).toEqual([
      [opened.id, 2],
      [DRAFT_ID, 1],
    ]);
    await expect(store.open({ feedId: 42 })).resolves.toMatchObject({
      id: opened.id,
    });

    drafts.delete(DRAFT_ID);
    await expect(store.get(DRAFT_ID)).rejects.toBeInstanceOf(
      DraftNotFoundError
    );
    await expect(
      store.setContent(DRAFT_ID, "en", "## Body")
    ).rejects.toBeInstanceOf(DraftNotFoundError);
  });
});
