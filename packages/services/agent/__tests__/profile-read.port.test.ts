import { drizzle } from "drizzle-orm/node-postgres";
import { describe, expect, it, vi } from "vitest";

import { relations } from "@chia/db/schema";
import type { ProfileEntry } from "@chia/db/schema";
import { ProfileEntryKind } from "@chia/db/types";

import { createProfileReadPort } from "../profile-read.port";

const { repo } = vi.hoisted(() => ({
  repo: { listProfileEntries: vi.fn() },
}));

vi.mock("@chia/db/repos/profile", () => repo);

const db = drizzle.mock({ relations });

const row = (overrides: Partial<ProfileEntry> = {}): ProfileEntry => ({
  id: 1,
  kind: ProfileEntryKind.Education,
  published: true,
  sortOrder: 0,
  data: {
    organization: "CGU",
    startDate: "2018-06-01",
    endDate: "2022-06-30",
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
    expect(entries).toEqual([
      { kind: ProfileEntryKind.Education, data: row().data },
    ]);
  });

  it("fails on a row whose data no longer matches its kind", async () => {
    repo.listProfileEntries.mockResolvedValueOnce([
      // A row written under an older shape.
      row({ data: { translations: {} } }),
    ]);
    const port = createProfileReadPort({ db, authorId: "author" });
    await expect(port.listPublished()).rejects.toThrow();
  });
});
