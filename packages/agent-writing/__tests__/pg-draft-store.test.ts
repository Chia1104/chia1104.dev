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
let draft: FeedDraftRecord;
const reset = () => {
  draft = {
    id: 7,
    feedId: null,
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
  };
};
reset();

const defined = <T extends object>(patch: T) =>
  Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined)
  );

vi.mock("@chia/db/repos/drafts", () => ({
  getFeedDraft: vi.fn(async () => ({ ...draft })),
  listOperatorFeedDraftChanges: vi.fn(async () => []),
  patchFeedDraft: vi.fn(async (_db: DB, input: PatchFeedDraftInput) => {
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
    draft = {
      ...draft,
      ...defined(input.meta ?? {}),
      translations,
      revision: draft.revision + 1,
    };
    return { status: "ok", draft: { ...draft } };
  }),
}));

const { PgDraftStore } = await import("../src/draft/pg-draft-store.ts");
const { DraftConflictError } = await import("../src/draft/operations.ts");

// SAFETY: every repo function is mocked above and never touches the handle.
const db = {} as DB;
const options = { draftId: 7, sessionId: "session-1" };

describe("PgDraftStore", () => {
  beforeEach(reset);

  it("leaves omitted per-locale fields alone when the patch carries explicit undefined keys", async () => {
    const store = new PgDraftStore(db, options);
    await store.patchTranslation("en", {
      title: "Title",
      excerpt: "Excerpt",
      description: "Description",
      summary: "Summary",
    });

    // Exactly what `patch_draft_meta` sends: every per-locale key present, most undefined.
    const next = await store.patchTranslation("en", {
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
    const store = new PgDraftStore(db, options);
    await store.setContent("en", "## Body");
    await store.patchTranslation("en", { title: "T", excerpt: "E" });
    const next = await store.patchTranslation("en", { excerpt: null });

    expect(next.translations.en?.excerpt).toBeNull();
    expect(next.translations.en?.title).toBe("T");
    expect(next.translations.en?.content).toBe("## Body");
  });

  it("merges feed-level metadata the same way", async () => {
    const store = new PgDraftStore(db, options);
    await store.patchFeedMeta({ slug: "a-slug", type: "post" });
    const next = await store.patchFeedMeta({
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
    const store = new PgDraftStore(db, options);
    const read = await store.get();
    draft = { ...draft, revision: read.revision + 1 };

    await expect(
      store.setContent("en", "## Stale", read.revision)
    ).rejects.toBeInstanceOf(DraftConflictError);
    // The conflict response still tells the store where the draft is now.
    expect(store.lastObservedRevision).toBe(read.revision + 1);
  });
});
