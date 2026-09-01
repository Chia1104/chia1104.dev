import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DB } from "@chia/db/client";
import type { Locale } from "@chia/db/types";
import type { JsonObject } from "@chia/utils/json";

/**
 * Fakes the repo layer with the same persistence semantics as the real tables: `meta` jsonb is
 * replaced wholesale on upsert, `content` is a column that an `undefined` leaves untouched.
 */
interface FakeSession {
  feedMeta: JsonObject;
  targetFeedId: number | null;
}
interface FakeDraftRow {
  meta: JsonObject;
  content: string | null;
}
interface FakeState {
  session: FakeSession;
  drafts: Map<Locale, FakeDraftRow>;
}
const state: FakeState = {
  session: { feedMeta: {}, targetFeedId: null },
  drafts: new Map(),
};

vi.mock("@chia/db/repos/agent", () => ({
  getWritingAgentSession: vi.fn(async () => ({ ...state.session })),
  getWritingAgentDrafts: vi.fn(async () =>
    [...state.drafts.entries()].map(([locale, row]) => ({
      locale,
      meta: row.meta,
      content: row.content,
    }))
  ),
  updateWritingAgentSession: vi.fn(
    async (
      _db: DB,
      _sessionId: string,
      patch: { feedMeta?: JsonObject; targetFeedId?: number | null }
    ) => {
      if (patch.feedMeta !== undefined) state.session.feedMeta = patch.feedMeta;
      if (patch.targetFeedId !== undefined)
        state.session.targetFeedId = patch.targetFeedId;
    }
  ),
  upsertWritingAgentDraft: vi.fn(
    async (
      _db: DB,
      input: { locale: Locale; meta: JsonObject; content?: string | null }
    ) => {
      const existing = state.drafts.get(input.locale);
      state.drafts.set(input.locale, {
        meta: input.meta,
        content:
          input.content === undefined
            ? (existing?.content ?? null)
            : input.content,
      });
    }
  ),
  deleteWritingAgentDrafts: vi.fn(async () => {
    state.drafts.clear();
  }),
}));

const { PgDraftStore } = await import("../src/draft/pg-draft-store.ts");

// SAFETY: every repo function is mocked above and never touches the handle.
const db = {} as DB;
const sessionId = "session-1";

describe("PgDraftStore", () => {
  beforeEach(() => {
    state.session = { feedMeta: {}, targetFeedId: null };
    state.drafts.clear();
  });

  it("leaves omitted per-locale fields alone when the patch carries explicit undefined keys", async () => {
    const store = new PgDraftStore(db);
    await store.patchTranslation(sessionId, "en", {
      title: "Title",
      excerpt: "Excerpt",
      description: "Description",
      summary: "Summary",
    });

    // Exactly what `patch_draft_meta` sends: every per-locale key present, most undefined.
    const next = await store.patchTranslation(sessionId, "en", {
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
    expect((await store.get(sessionId)).translations.en).toMatchObject({
      title: "New title",
      excerpt: "Excerpt",
      description: "Description",
      summary: "Summary",
    });
  });

  it("clears a field on null and keeps the body across metadata patches", async () => {
    const store = new PgDraftStore(db);
    await store.setContent(sessionId, "en", "## Body");
    await store.patchTranslation(sessionId, "en", { title: "T", excerpt: "E" });
    const next = await store.patchTranslation(sessionId, "en", {
      excerpt: null,
    });

    expect(next.translations.en?.excerpt).toBeNull();
    expect(next.translations.en?.title).toBe("T");
    expect(next.translations.en?.content).toBe("## Body");
    expect(state.drafts.get("en")?.content).toBe("## Body");
  });

  it("merges feed-level metadata the same way", async () => {
    const store = new PgDraftStore(db);
    await store.patchFeedMeta(sessionId, { slug: "a-slug", type: "post" });
    const next = await store.patchFeedMeta(sessionId, {
      slug: undefined,
      type: undefined,
      defaultLocale: "en",
    });

    expect(next.feedMeta).toEqual({
      slug: "a-slug",
      type: "post",
      defaultLocale: "en",
    });
    expect(state.session.feedMeta).toEqual({
      slug: "a-slug",
      type: "post",
      defaultLocale: "en",
    });
  });
});
