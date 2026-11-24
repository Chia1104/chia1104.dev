import { call } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, vi } from "vitest";

import { FeedOrderBy } from "@chia/db/types";
import { contextOf } from "@chia/test/context";
import { stubTestEnv } from "@chia/test/env";
import { it as orpcIt } from "@chia/test/orpc";
import { ADMIN_ID, sessionOf } from "@chia/test/session";

import type { BaseOSContext } from "../../shared/context";
import type { UserDetail } from "../user.contract";
import type * as userRouteModule from "../user.route";

const { repo, authRepo } = vi.hoisted(() => ({
  repo: {
    listUsers: vi.fn(),
    getUserDetail: vi.fn(),
  },
  authRepo: {
    banUser: vi.fn(),
    unbanUser: vi.fn(),
    deleteUserSessions: vi.fn(),
    removeUser: vi.fn(),
    updateUserProfile: vi.fn(),
    findSession: vi.fn(),
  },
}));

vi.mock("@chia/db/repos/users", () => repo);
vi.mock("@chia/db/repos/auth", () => authRepo);

const detail: UserDetail = {
  user: {
    id: "u1",
    name: "Ada",
    email: "ada@example.com",
    image: null,
    isAnonymous: false,
    banned: false,
    banReason: null,
    banExpires: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  },
  accounts: [{ providerId: "github", createdAt: "2026-08-01T00:00:00.000Z" }],
  sessions: 2,
  apiKeys: 1,
};

const it = orpcIt.extend("context", ({ session }) =>
  contextOf<BaseOSContext>(session)
);

type UserRoutes = typeof userRouteModule;
let routes: UserRoutes;

describe("user routes", () => {
  beforeAll(async () => {
    stubTestEnv({
      SKIP_ENV_VALIDATION: "true",
      ENV: "test",
      LOCAL_ADMIN_ID: ADMIN_ID,
    });
    routes = await import("../user.route");
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    repo.listUsers.mockResolvedValue({ items: [], nextCursor: null });
    repo.getUserDetail.mockResolvedValue(detail);
    authRepo.banUser.mockResolvedValue(true);
    authRepo.removeUser.mockResolvedValue(true);
    authRepo.deleteUserSessions.mockResolvedValue(true);
    authRepo.updateUserProfile.mockResolvedValue(true);
  });

  describe("signed-in non-admin", () => {
    it.override("session", () => sessionOf("someone-else"));

    it("refuses both reads", async ({ context }) => {
      await expect(
        call(routes.listUsersRoute, {}, { context })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        call(routes.getUserRoute, { id: "u1" }, { context })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(repo.listUsers).not.toHaveBeenCalled();
      expect(repo.getUserDetail).not.toHaveBeenCalled();
    });
  });

  it("passes the filters through with the contract's defaults filled in", async ({
    context,
  }) => {
    await call(
      routes.listUsersRoute,
      { query: "ada", banned: true, anonymous: false },
      { context }
    );
    expect(repo.listUsers).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: "ada",
        banned: true,
        anonymous: false,
        limit: 10,
        orderBy: FeedOrderBy.CreatedAt,
        sortOrder: "desc",
      })
    );
  });

  it("reads one account and answers NOT_FOUND for an unknown id", async ({
    context,
  }) => {
    const result = await call(routes.getUserRoute, { id: "u1" }, { context });
    expect(result).toEqual(detail);

    repo.getUserDetail.mockResolvedValueOnce(null);
    await expect(
      call(routes.getUserRoute, { id: "nope" }, { context })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("bans with an end computed from the duration", async ({ context }) => {
    vi.useFakeTimers({ now: new Date("2026-08-01T00:00:00.000Z") });
    await call(
      routes.banUserRoute,
      { id: "u1", reason: "spam", expiresIn: 3600 },
      { context }
    );
    vi.useRealTimers();

    expect(authRepo.banUser).toHaveBeenCalledWith(expect.anything(), {
      id: "u1",
      reason: "spam",
      expiresAt: new Date("2026-08-01T01:00:00.000Z"),
    });
  });

  it("refuses to ban or delete the operator", async ({ context }) => {
    for (const route of [routes.banUserRoute, routes.removeUserRoute]) {
      await expect(
        call(route, { id: ADMIN_ID }, { context })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    expect(authRepo.banUser).not.toHaveBeenCalled();
    expect(authRepo.removeUser).not.toHaveBeenCalled();
  });

  it("signs a user out everywhere, but keeps the operator's own session", async ({
    context,
  }) => {
    await call(routes.revokeUserSessionsRoute, { id: "u1" }, { context });
    expect(authRepo.deleteUserSessions).toHaveBeenLastCalledWith(
      expect.anything(),
      "u1",
      undefined
    );

    await call(routes.revokeUserSessionsRoute, { id: ADMIN_ID }, { context });
    expect(authRepo.deleteUserSessions).toHaveBeenLastCalledWith(
      expect.anything(),
      ADMIN_ID,
      "s1"
    );
  });

  it("answers NOT_FOUND when the user is gone", async ({ context }) => {
    authRepo.removeUser.mockResolvedValueOnce(false);
    await expect(
      call(routes.removeUserRoute, { id: "nope" }, { context })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  describe("profile", () => {
    it.override("session", () => sessionOf("someone-else"));

    it("edits only the caller's own row", async ({ context }) => {
      await call(
        routes.updateProfileRoute,
        { name: "Grace", image: null },
        { context }
      );
      expect(authRepo.updateUserProfile).toHaveBeenCalledWith(
        expect.anything(),
        { id: "someone-else", name: "Grace", image: null }
      );
    });
  });

  describe("guest", () => {
    it.override("session", () => sessionOf("guest", { isAnonymous: true }));

    it("has no profile to edit", async ({ context }) => {
      await expect(
        call(
          routes.updateProfileRoute,
          { name: "Grace", image: null },
          { context }
        )
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });
  });
});
