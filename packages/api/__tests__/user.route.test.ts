import { call } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, vi } from "vitest";

import { stubTestEnv } from "@chia/test/env";
import {
  ADMIN_ID,
  contextOf,
  describe,
  expect,
  it as orpcIt,
  sessionOf,
} from "@chia/test/orpc";

import type { UserDetail } from "../orpc/contracts/user.contract";
import type * as userRouteModule from "../orpc/routes/user.route";
import type { BaseOSContext } from "../orpc/utils";

const { repo } = vi.hoisted(() => ({
  repo: {
    listUsers: vi.fn(),
    getUserDetail: vi.fn(),
  },
}));

vi.mock("@chia/db/repos/users", () => repo);

const detail: UserDetail = {
  user: {
    id: "u1",
    name: "Ada",
    email: "ada@example.com",
    image: null,
    role: "user",
    isAnonymous: false,
    emailVerified: true,
    banned: false,
    banReason: null,
    banExpires: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  },
  accounts: [{ providerId: "github", createdAt: "2026-08-01T00:00:00.000Z" }],
  passkeys: 0,
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
    routes = await import("../orpc/routes/user.route");
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    repo.listUsers.mockResolvedValue({ items: [], nextCursor: null });
    repo.getUserDetail.mockResolvedValue(detail);
  });

  describe("signed-in non-admin", () => {
    it.override("session", () => sessionOf("someone-else", "user"));

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
        orderBy: "createdAt",
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
});
