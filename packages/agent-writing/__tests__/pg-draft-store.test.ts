import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DB } from "@chia/db/client";
import type {
  FeedDraftRecord,
  PatchFeedDraftInput,
} from "@chia/db/repos/drafts";
import { settleFeedDraftPatch } from "@chia/db/repos/drafts/patch";
import { FeedType, Locale } from "@chia/db/types";

/**
 * Fakes the drafts repo with the same write semantics as the real one: `undefined` leaves a
 * field alone, `null` clears it, every write bumps `revision`, and a field that moved off its
 * `base` refuses the whole write with the current row.
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
  contentHash: "hash",
  appliedRevisionId: null,
  appliedHash: null,
  lastAuthor: "operator",
  lastSessionId: null,
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
  listFeedDraftChangesSince: vi.fn(async () => []),
  patchFeedDraft: vi.fn(async (_db: DB, input: PatchFeedDraftInput) => {
    const draft = drafts.get(input.draftId);
    if (!draft) return { status: "not_found" };
    const settled = settleFeedDraftPatch(draft, input);
    if (!settled.ok) {
      return {
        status: "conflict",
        draft: { ...draft },
        rejected: settled.rejected,
      };
    }
    const translations = { ...draft.translations };
    for (const locale of Object.values(Locale)) {
      const patch = input.translations?.[locale];
      if (!patch) continue;
      translations[locale] = {
        title: null,
        excerpt: null,
        description: null,
        content: null,
        ...translations[locale],
        ...defined(patch),
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
    userId: "author",
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

  it("does not mark listed drafts or newer revisions as observed", async () => {
    const store = build();
    await store.list();
    expect(store.observedRevisions.size).toBe(0);

    await store.get(DRAFT_ID);
    drafts.set(DRAFT_ID, { ...record(DRAFT_ID), revision: 2 });
    expect(await store.list()).toMatchObject([{ id: DRAFT_ID, revision: 2 }]);
    expect(store.observedRevisions.get(DRAFT_ID)).toBe(1);
  });

  it("leaves omitted per-locale fields alone when the patch carries explicit undefined keys", async () => {
    const store = build();
    await store.write(DRAFT_ID, {
      translations: {
        en: {
          title: "Title",
          excerpt: "Excerpt",
          description: "Description",
        },
      },
    });

    // Exactly what `write_draft` sends: every per-locale key present, most undefined.
    const next = await store.write(DRAFT_ID, {
      translations: {
        en: {
          title: "New title",
          excerpt: undefined,
          description: undefined,
        },
      },
    });

    expect(next.translations.en).toMatchObject({
      title: "New title",
      excerpt: "Excerpt",
      description: "Description",
    });
  });

  it("clears a field on null and keeps the body across metadata patches", async () => {
    const store = build();
    await store.write(DRAFT_ID, {
      translations: { en: { content: "## Body" } },
    });
    await store.write(DRAFT_ID, {
      translations: { en: { title: "T", excerpt: "E" } },
    });
    const next = await store.write(DRAFT_ID, {
      translations: { en: { excerpt: null } },
    });

    expect(next.translations.en?.excerpt).toBeNull();
    expect(next.translations.en?.title).toBe("T");
    expect(next.translations.en?.content).toBe("## Body");
  });

  it("merges feed-level metadata the same way", async () => {
    const store = build();
    await store.write(DRAFT_ID, {
      meta: { slug: "a-slug", type: FeedType.Post },
    });
    const next = await store.write(DRAFT_ID, {
      meta: { slug: undefined, type: undefined, defaultLocale: Locale.En },
    });

    expect(next).toMatchObject({
      slug: "a-slug",
      type: FeedType.Post,
      defaultLocale: Locale.En,
    });
  });

  const operatorWrites = (
    locale: Locale,
    patch: { title?: string; content?: string }
  ) => {
    const current = drafts.get(DRAFT_ID);
    if (!current) throw new Error("fixture draft missing");
    drafts.set(DRAFT_ID, {
      ...current,
      revision: current.revision + 1,
      translations: {
        ...current.translations,
        [locale]: {
          title: null,
          excerpt: null,
          description: null,
          content: null,
          ...current.translations[locale],
          ...patch,
        },
      },
    });
  };

  it("refuses a write over a field the operator changed after the model read it", async () => {
    const store = build();
    await store.write(DRAFT_ID, {
      translations: { en: { content: "## Old" } },
    });
    operatorWrites(Locale.En, { content: "## Operator version" });

    await expect(
      store.write(DRAFT_ID, { translations: { en: { content: "## Stale" } } })
    ).rejects.toThrow("Someone else changed en.content");
    expect(drafts.get(DRAFT_ID)?.translations.en?.content).toBe(
      "## Operator version"
    );

    // Reading it again is what makes the next write legitimate.
    await store.get(DRAFT_ID);
    await store.write(DRAFT_ID, {
      translations: { en: { content: "## New" } },
    });
    expect(drafts.get(DRAFT_ID)?.translations.en?.content).toBe("## New");
  });

  it("writes one locale while the operator keeps writing another", async () => {
    const store = build();
    await store.get(DRAFT_ID);
    operatorWrites(Locale.ZhTW, { title: "標題", content: "內文" });

    const next = await store.write(DRAFT_ID, {
      translations: { en: { title: "Title", content: "## Translated" } },
    });
    expect(next.translations["zh-TW"]?.content).toBe("內文");
    expect(next.translations.en?.content).toBe("## Translated");

    // The model has not seen the operator's text, so it still cannot write over it.
    await expect(
      store.write(DRAFT_ID, { translations: { "zh-TW": { content: "覆蓋" } } })
    ).rejects.toBeInstanceOf(DraftConflictError);
  });

  it("tracks the revision it read per draft and names a draft that is gone", async () => {
    const store = build();
    const opened = await store.open({ feedId: 42 });
    await store.write(opened.id, {
      translations: { en: { content: "## Body" } },
    });
    await store.get(DRAFT_ID);

    // Only a full read counts as seen: the result of a write may carry someone else's change.
    expect([...store.observedRevisions]).toEqual([
      [opened.id, 1],
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
      store.write(DRAFT_ID, { translations: { en: { content: "## Body" } } })
    ).rejects.toBeInstanceOf(DraftNotFoundError);
  });
});
