import { createMiddleware } from "hono/factory";
import { vi } from "vitest";

import { baseOS } from "@chia/api/orpc/utils";
import { CallerTier } from "@chia/service-kit/policies/caller.policy";

// ============================================
// oRPC guards
//
// Routes migrated off Hono are guarded by the oRPC middleware in
// `@chia/api/orpc/guards/*` rather than `apps/service/src/guards/*`, so those modules
// need pass-through equivalents of their own.
// ============================================

const FAKE_API_KEY = {
  id: "test-api-key-id",
  projectId: null,
  userId: "test-user-id",
  enabled: true,
};

/** Mock for the oRPC `rateLimitGuard` — skips rate limiting. */
export const orpcRateLimitGuard = vi.fn(() =>
  baseOS.middleware(({ next }) => next())
);

/** Matches `LOCAL_ADMIN_ID` in `setup.ts`, which is what `getAdminId()` resolves under test. */
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

/**
 * Drives the tier the mocked `callerGuard` reports, so a controller test can exercise the
 * same procedure as each audience. Credential *verification* is what is mocked away here;
 * the tier → visible-scope rule the routes apply is real and still runs.
 */
export const setCallerTier = (tier: CallerTier) => {
  callerTier = tier;
};

/**
 * Mock for the oRPC `callerGuard`.
 *
 * Credential *verification* is what is stubbed out; the `minTier` admission check is real,
 * so a controller test still covers which tier each procedure demands.
 */
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

/** Mock for the oRPC `tieredRateLimitGuard` — skips rate limiting. */
export const orpcTieredRateLimitGuard = vi.fn(() =>
  baseOS.middleware(({ next }) => next())
);

/** Mock for the oRPC `captchaGuard` — skips captcha verification. */
export const orpcCaptchaGuard = baseOS.middleware(({ next }) => next());

/** Mock for the oRPC `aiKeyGuard` — injects a fake provider token. */
export const orpcAiKeyGuard = vi.fn(() =>
  baseOS.middleware(({ next }) =>
    next({ context: { AI_AUTH_TOKEN: "mock-ai-api-key" } })
  )
);

/**
 * Mock for rateLimiterGuard
 * 在測試中跳過 rate limiting 檢查
 */
export const rateLimiterGuard = vi.fn(() =>
  createMiddleware(async (_c, next) => {
    await next();
  })
);

/**
 * Mock for verifyAuth
 * 在測試中跳過身份驗證，可選擇性設置模擬用戶
 */
export const verifyAuth = vi.fn((_rootOnly?: boolean) =>
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

/**
 * Mock for ai guard
 * 在測試中跳過 AI API key 驗證
 */
export const ai = vi.fn((_provider?: string, _enabled?: any) =>
  createMiddleware(async (c, next) => {
    c.set("AI_AUTH_TOKEN", "mock-ai-api-key");
    await next();
  })
);

export const AI_AUTH_TOKEN = "AI_AUTH_TOKEN";

/**
 * 重置所有 guard mocks
 */
export const resetAllGuardMocks = () => {
  rateLimiterGuard.mockClear();
  verifyAuth.mockClear();
  ai.mockClear();
  callerTier = CallerTier.Root;
};

/**
 * 自訂 mock 行為的輔助函數
 */

// 讓 verifyAuth 返回未授權錯誤
export const mockVerifyAuthUnauthorized = () => {
  verifyAuth.mockImplementationOnce(() =>
    createMiddleware(async (c) => {
      return c.json({ error: "Unauthorized" }, 401);
    })
  );
};

// 讓 verifyAuth 返回禁止訪問錯誤
export const mockVerifyAuthForbidden = () => {
  verifyAuth.mockImplementationOnce(() =>
    createMiddleware(async (c) => {
      return c.json({ error: "Forbidden" }, 403);
    })
  );
};

// 讓 rateLimiter 返回 429 錯誤
export const mockRateLimiterExceeded = () => {
  rateLimiterGuard.mockImplementationOnce(() =>
    createMiddleware(async (c) => {
      return c.json({ error: "Too Many Requests" }, 429);
    })
  );
};

// 設置自訂的用戶資料
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
