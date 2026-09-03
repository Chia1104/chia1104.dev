import { describe, expect, it, vi } from "vitest";

import type { DB } from "@chia/db/client";
import type { ProfileEntry } from "@chia/db/schema";

import { createProfileReadPort } from "../agents/profile-read.port";

const { repo } = vi.hoisted(() => ({
  repo: { listProfileEntries: vi.fn() },
}));

vi.mock("@chia/db/repos/profile", () => repo);

/* SAFETY: the repository is mocked, so the handle is never used. */
const db = {} as DB;

const row = (overrides: Partial<ProfileEntry> = {}): ProfileEntry => ({
  id: 1,
  kind: "education",
  published: true,
  sortOrder: 0,
  data: {
    organization: "CGU",
    startDate: "2018-06",
    endDate: "2022-06",
    translations: { en: { title: "MIS" } },
  },
  userId: "author",
  createdAt: new Date(0),
  updatedAt: new Date(0),
  deletedAt: null,
  ...overrides,
});

describe("createProfileReadPort", () => {
  it("lists only the author's published rows, parsed for their kind", async () => {
    repo.listProfileEntries.mockResolvedValueOnce([row()]);
    const port = createProfileReadPort({ db, authorId: "author" });

    const entries = await port.listPublished();

    expect(repo.listProfileEntries).toHaveBeenCalledWith(db, {
      userId: "author",
      published: true,
    });
    expect(entries).toEqual([{ kind: "education", data: row().data }]);
  });

  it("fails on a row whose data no longer matches its kind", async () => {
    repo.listProfileEntries.mockResolvedValueOnce([
      // SAFETY: simulates a row written under an older shape.
      row({ data: { translations: {} } as never }),
    ]);
    const port = createProfileReadPort({ db, authorId: "author" });
    await expect(port.listPublished()).rejects.toThrow();
  });
});
