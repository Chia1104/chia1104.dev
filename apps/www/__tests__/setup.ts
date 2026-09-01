import "@testing-library/jest-dom/vitest";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";

import { handlers } from "./mocks/handlers";

vi.mock("server-only", () => ({}));

vi.mock("client-only", () => ({}));

export const server = setupServer(...handlers);

beforeAll(() => {
  server.listen({ onUnhandledRequest: "warn" });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

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

vi.mock("next-intl", async () => {
  const actual = await vi.importActual("next-intl");
  return {
    ...actual,
    useTranslations: () => (key: string) => key,
    useLocale: () => "en-US",
  };
});
