import { call } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, vi } from "vitest";

import type { DB } from "@chia/db/client";
import type { ProfileEntry } from "@chia/db/schema";
import { stubTestEnv } from "@chia/test/env";
import {
  ADMIN_ID,
  contextOf,
  describe,
  expect,
  it as orpcIt,
  sessionOf,
} from "@chia/test/orpc";

import type * as profileRouteModule from "../orpc/routes/profile.route";
import type { BaseOSContext } from "../orpc/utils";

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
  kind: "experience",
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
    routes = await import("../orpc/routes/profile.route");
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
      { kind: "experience" },
      { context }
    );
    expect(repo.listProfileEntries).toHaveBeenCalledWith(expect.anything(), {
      userId: ADMIN_ID,
      kind: "experience",
    });
    const [entry] = listed.items;
    expect(entry?.kind).toBe("experience");
    if (entry?.kind !== "experience") throw new Error("kind mismatch");
    expect(entry.data.organization).toBe("LeadBest");
  });

  it("creates for the admin and rejects data of another kind", async ({
    context,
  }) => {
    const created = await call(
      routes.createProfileEntryRoute,
      {
        kind: "experience",
        data: experienceData,
        published: false,
        sortOrder: 2,
      },
      { context }
    );
    expect(repo.createProfileEntry).toHaveBeenCalledWith(expect.anything(), {
      userId: ADMIN_ID,
      kind: "experience",
      data: experienceData,
      published: false,
      sortOrder: 2,
    });
    expect(created.entry.id).toBe(9);

    await expect(
      call(
        routes.createProfileEntryRoute,
        {
          kind: "about",
          // SAFETY: deliberately wrong for the kind; the contract must refuse it.
          data: { translations: {} } as never,
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
          kind: "experience",
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
      row({ kind: "project", data: experienceData })
    );
    await expect(
      call(routes.getProfileEntryRoute, { id: 3 }, { context })
    ).resolves.toMatchObject({ entry: { kind: "project" } });

    repo.getProfileEntry.mockResolvedValueOnce(
      // SAFETY: simulates a row written under an older shape.
      row({ kind: "experience", data: { translations: {} } as never })
    );
    await expect(
      call(routes.getProfileEntryRoute, { id: 3 }, { context })
    ).rejects.toThrow();
  });
});
