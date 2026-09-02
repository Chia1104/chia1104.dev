import { createMiddleware } from "hono/factory";
import { vi } from "vitest";

import { baseOS } from "@chia/api/orpc/utils";
import { CallerTier } from "@chia/service-kit/policies/caller.policy";

const FAKE_API_KEY = {
  id: "test-api-key-id",
  userId: "test-user-id",
  enabled: true,
};

export const orpcRateLimitGuard = vi.fn(() =>
  baseOS.middleware(({ next }) => next())
);

/** Same value as `LOCAL_ADMIN_ID` in `setup.ts` (`getAdminId()` under test). */
export const TEST_ADMIN_ID = "test-local-admin-id";

const TEST_SESSION = {
  session: { id: "test-session-id" },
  user: {
    id: TEST_ADMIN_ID,
    email: "test@example.com",
    name: "Test User",
    role: "root",
    isAnonymous: false,
  },
};

const GUEST_SESSION = {
  session: { id: "test-guest-session-id" },
  user: {
    id: "test-guest-id",
    email: "temp-guest@example.com",
    name: "Anonymous",
    role: "user",
    isAnonymous: true,
  },
};

let callerTier: CallerTier = CallerTier.Root;

export const setCallerTier = (tier: CallerTier) => {
  callerTier = tier;
};

/** Stubs credential verification; the `minTier` admission check still runs. */
export const orpcCallerGuard = vi.fn((options: { minTier?: CallerTier } = {}) =>
  baseOS
    .errors({ UNAUTHORIZED: {}, FORBIDDEN: {} })
    .middleware(({ next, errors }) => {
      if (callerTier < (options.minTier ?? CallerTier.Anonymous)) {
        throw callerTier === CallerTier.Anonymous
          ? errors.UNAUTHORIZED()
          : errors.FORBIDDEN();
      }

      return next({
        context: {
          caller: {
            tier: callerTier,
            adminId: TEST_ADMIN_ID,
            session:
              callerTier >= CallerTier.Session
                ? (TEST_SESSION as never)
                : callerTier === CallerTier.Guest
                  ? (GUEST_SESSION as never)
                  : undefined,
            apiKey: callerTier === CallerTier.ApiKey ? FAKE_API_KEY : undefined,
          },
        },
      });
    })
);

export const orpcTieredRateLimitGuard = vi.fn(() =>
  baseOS.middleware(({ next }) => next())
);

export const orpcCaptchaGuard = baseOS.middleware(({ next }) => next());

export const orpcAiKeyGuard = vi.fn(() =>
  baseOS.middleware(({ next }) =>
    next({ context: { AI_AUTH_TOKEN: "mock-ai-api-key" } })
  )
);

export const rateLimiterGuard = vi.fn(() =>
  createMiddleware(async (_c, next) => {
    await next();
  })
);

export const verifyAuth = vi.fn(
  (_options?: { rootOnly?: boolean; allowAnonymous?: boolean }) =>
    createMiddleware(async (c, next) => {
      c.set("user", {
        id: "test-user-id",
        email: "test@example.com",
        name: "Test User",
        role: "root",
        emailVerified: true,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        banned: false,
        banReason: null,
        banExpires: null,
      });
      await next();
    })
);

export const ai = vi.fn((_provider?: string, _enabled?: any) =>
  createMiddleware(async (c, next) => {
    c.set("AI_AUTH_TOKEN", "mock-ai-api-key");
    await next();
  })
);

export const AI_AUTH_TOKEN = "AI_AUTH_TOKEN";

export const resetAllGuardMocks = () => {
  rateLimiterGuard.mockClear();
  verifyAuth.mockClear();
  ai.mockClear();
  callerTier = CallerTier.Root;
};

export const mockVerifyAuthUnauthorized = () => {
  verifyAuth.mockImplementationOnce(() =>
    createMiddleware(async (c) => {
      return c.json({ error: "Unauthorized" }, 401);
    })
  );
};

export const mockVerifyAuthForbidden = () => {
  verifyAuth.mockImplementationOnce(() =>
    createMiddleware(async (c) => {
      return c.json({ error: "Forbidden" }, 403);
    })
  );
};

export const mockRateLimiterExceeded = () => {
  rateLimiterGuard.mockImplementationOnce(() =>
    createMiddleware(async (c) => {
      return c.json({ error: "Too Many Requests" }, 429);
    })
  );
};

export const mockVerifyAuthWithUser = (user: any) => {
  verifyAuth.mockImplementationOnce(() =>
    createMiddleware(async (c, next) => {
      c.set("user", {
        id: user.id ?? "test-user-id",
        email: user.email ?? "test@example.com",
        name: user.name ?? "Test User",
        role: user.role ?? "root",
        emailVerified: user.emailVerified ?? true,
        image: user.image ?? null,
        createdAt: user.createdAt ?? new Date(),
        updatedAt: user.updatedAt ?? new Date(),
        banned: user.banned ?? false,
        banReason: user.banReason ?? null,
        banExpires: user.banExpires ?? null,
        ...user,
      });
      await next();
    })
  );
};
