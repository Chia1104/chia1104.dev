import { createMiddleware } from "hono/factory";
import { vi } from "vitest";

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
 * Mock for siteverify (captcha)
 * 在測試中跳過 captcha 驗證
 */
export const siteverify = createMiddleware(async (_c, next) => {
  await next();
});

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
 * Mock for apikeyVerify
 * 在測試中跳過 API key 驗證
 */
export const apikeyVerify = vi.fn(
  (_options?: { permissions?: Record<string, string[]>; projectId?: number }) =>
    createMiddleware(async (_c, next) => {
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
  apikeyVerify.mockClear();
  ai.mockClear();
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

// 讓 apikeyVerify 返回未授權錯誤
export const mockApikeyVerifyUnauthorized = () => {
  apikeyVerify.mockImplementationOnce(() =>
    createMiddleware(async (c) => {
      return c.json(
        {
          error: "Unauthorized",
          issues: [{ field: "api_key", message: "Missing or invalid API key" }],
        },
        401
      );
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

// 讓 siteverify (captcha) 失敗
export const mockCaptchaFailed = () => {
  return createMiddleware(async (c) => {
    return c.json(
      {
        error: "Bad Request",
        issues: [{ field: "captcha", message: "CAPTCHA_FAILED" }],
      },
      400
    );
  });
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
