import { beforeEach, describe, expect, it, vi } from "vitest";

const STORAGE_KEY = "chia.dash.draft-snapshots";

describe("draft snapshot store", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("discards snapshots written under another schema version", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: { entries: [{ draftId: 7, revision: 1, patch: { slug: "x" } }] },
        version: 0,
      })
    );
    const { readDraftSnapshot } =
      await import("../src/components/feed/draft-snapshot");
    expect(readDraftSnapshot(7)).toBeNull();
  });

  it("rehydrates snapshots of the current version", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: { entries: [{ draftId: 7, revision: 1, patch: { slug: "x" } }] },
        version: 1,
      })
    );
    const { readDraftSnapshot } =
      await import("../src/components/feed/draft-snapshot");
    expect(readDraftSnapshot(7)).toEqual({ revision: 1, patch: { slug: "x" } });
  });
});
