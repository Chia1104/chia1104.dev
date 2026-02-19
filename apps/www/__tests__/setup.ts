/**
 * Vitest 測試環境設置
 */
import "@testing-library/jest-dom/vitest";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";

import { handlers } from "./mocks/handlers";

// Mock server-only module
vi.mock("server-only", () => ({}));

// Mock client-only module
vi.mock("client-only", () => ({}));

// 設置 MSW server
export const server = setupServer(...handlers);

// 在所有測試開始前啟動 mock server
beforeAll(() => {
  server.listen({ onUnhandledRequest: "warn" });
});

// 每個測試後重置 handlers
afterEach(() => {
  server.resetHandlers();
});

// 所有測試完成後關閉 server
afterAll(() => {
  server.close();
});

// Mock Next.js router
vi.mock("next/navigation", async () => {
  const actual = await vi.importActual("next/navigation");
  return {
    ...actual,
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
      pathname: "/",
      query: {},
    }),
    usePathname: () => "/",
    useSearchParams: () => new URLSearchParams(),
    useSelectedLayoutSegments: () => [],
    redirect: vi.fn(),
  };
});

// Mock next-intl
vi.mock("next-intl", async () => {
  const actual = await vi.importActual("next-intl");
  return {
    ...actual,
    useTranslations: () => (key: string) => key,
    useLocale: () => "en-US",
  };
});
