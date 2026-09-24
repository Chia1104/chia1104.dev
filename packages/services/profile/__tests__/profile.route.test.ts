import { call } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, vi } from "vitest";

import type { DB } from "@chia/db/client";
import type { ProfileEntry } from "@chia/db/schema";
import { ProfileEntryKind } from "@chia/db/types";
import { contextOf } from "@chia/test/context";
import { stubTestEnv } from "@chia/test/env";
import { it as orpcIt } from "@chia/test/orpc";
import { ADMIN_ID, sessionOf } from "@chia/test/session";

import type { BaseOSContext } from "../../shared/context";
import type * as profileRouteModule from "../profile.route";

const { repo } = vi.hoisted(() => ({
  repo: {
    listProfileEntries: vi.fn(),
    getProfileEntry: vi.fn(),
    createProfileEntry: vi.fn(),
    updateProfileEntry: vi.fn(),
    softDeleteProfileEntry: vi.fn(),
  },
}));

vi.mock("@chia/db/repos/profile", () => repo);

const it = orpcIt.extend("context", ({ session }) =>
  contextOf<BaseOSContext>(session)
);

const experienceData = {
  organization: "LeadBest",
  startDate: "2023-03-01",
  stack: ["TypeScript"],
  translations: { "zh-TW": { title: "前端工程師" } },
};

const row = (overrides: Partial<ProfileEntry> = {}): ProfileEntry => ({
  id: 3,
  kind: ProfileEntryKind.Experience,
  published: true,
  sortOrder: 0,
  data: experienceData,
  userId: ADMIN_ID,
  createdAt: new Date("2026-09-01T00:00:00Z"),
  updatedAt: new Date("2026-09-01T00:00:00Z"),
  deletedAt: null,
  ...overrides,
});

type ProfileRoutes = typeof profileRouteModule;
let routes: ProfileRoutes;

describe("profile routes", () => {
  beforeAll(async () => {
    stubTestEnv({
      SKIP_ENV_VALIDATION: "true",
      ENV: "test",
      LOCAL_ADMIN_ID: ADMIN_ID,
    });
    routes = await import("../profile.route");
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    repo.listProfileEntries.mockResolvedValue([row()]);
    repo.getProfileEntry.mockResolvedValue(row());
    repo.createProfileEntry.mockImplementation(
      async (_db: DB, input: Partial<ProfileEntry>) => row({ ...input, id: 9 })
    );
    repo.updateProfileEntry.mockImplementation(
      async (_db: DB, id: number, patch: Partial<ProfileEntry>) =>
        row({ ...patch, id })
    );
    repo.softDeleteProfileEntry.mockResolvedValue(true);
  });

  describe("signed-in non-admin", () => {
    it.override("session", () => sessionOf("someone-else", "user"));

    it("refuses every route", async ({ context }) => {
      await expect(
        call(routes.listProfileEntriesRoute, {}, { context })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        call(routes.removeProfileEntryRoute, { id: 3 }, { context })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(repo.listProfileEntries).not.toHaveBeenCalled();
      expect(repo.softDeleteProfileEntry).not.toHaveBeenCalled();
    });
  });

  it("lists the admin's rows and returns kind-correlated entries", async ({
    context,
  }) => {
    const listed = await call(
      routes.listProfileEntriesRoute,
      { kind: ProfileEntryKind.Experience },
      { context }
    );
    expect(repo.listProfileEntries).toHaveBeenCalledWith(expect.anything(), {
      userId: ADMIN_ID,
      kind: ProfileEntryKind.Experience,
    });
    const [entry] = listed.items;
    expect(entry?.kind).toBe(ProfileEntryKind.Experience);
    if (entry?.kind !== ProfileEntryKind.Experience)
      throw new Error("kind mismatch");
    expect(entry.data.organization).toBe("LeadBest");
  });

  it("creates for the admin and rejects data of another kind", async ({
    context,
  }) => {
    const created = await call(
      routes.createProfileEntryRoute,
      {
        kind: ProfileEntryKind.Experience,
        data: experienceData,
        published: false,
        sortOrder: 2,
      },
      { context }
    );
    expect(repo.createProfileEntry).toHaveBeenCalledWith(expect.anything(), {
      userId: ADMIN_ID,
      kind: ProfileEntryKind.Experience,
      data: experienceData,
      published: false,
      sortOrder: 2,
    });
    expect(created.entry.id).toBe(9);

    await expect(
      call(
        routes.createProfileEntryRoute,
        {
          kind: ProfileEntryKind.About,
          // No locale at all; the contract must refuse it.
          data: { translations: {} },
          published: false,
          sortOrder: 0,
        },
        { context }
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("answers NOT_FOUND for a row that is gone", async ({ context }) => {
    repo.getProfileEntry.mockResolvedValueOnce(undefined);
    await expect(
      call(routes.getProfileEntryRoute, { id: 3 }, { context })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    repo.updateProfileEntry.mockResolvedValueOnce(undefined);
    await expect(
      call(
        routes.updateProfileEntryRoute,
        {
          id: 3,
          kind: ProfileEntryKind.Experience,
          data: experienceData,
          published: true,
          sortOrder: 0,
        },
        { context }
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    repo.softDeleteProfileEntry.mockResolvedValueOnce(false);
    await expect(
      call(routes.removeProfileEntryRoute, { id: 3 }, { context })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("fails loudly on a stored row that no longer matches its kind", async ({
    context,
  }) => {
    repo.getProfileEntry.mockResolvedValueOnce(
      row({ kind: ProfileEntryKind.Project, data: experienceData })
    );
    await expect(
      call(routes.getProfileEntryRoute, { id: 3 }, { context })
    ).resolves.toMatchObject({ entry: { kind: ProfileEntryKind.Project } });

    repo.getProfileEntry.mockResolvedValueOnce(
      // A row written under an older shape.
      row({ kind: ProfileEntryKind.Experience, data: { translations: {} } })
    );
    await expect(
      call(routes.getProfileEntryRoute, { id: 3 }, { context })
    ).rejects.toThrow();
  });
});
