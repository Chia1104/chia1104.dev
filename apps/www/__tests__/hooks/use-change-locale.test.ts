import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// 使用 vi.hoisted 確保 mock 函數在正確的時機創建
const { mockPush, mockRefresh, mockPathname } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockRefresh: vi.fn(),
  mockPathname: "/test-path",
}));

// Mock the routing module
vi.mock("@/libs/i18n/routing", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  usePathname: () => mockPathname,
}));

import { useChangeLocale } from "@/hooks/use-change-locale";

describe("useChangeLocale Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("應該返回 changeLocale 函數", () => {
    const { result } = renderHook(() => useChangeLocale());
    expect(typeof result.current).toBe("function");
  });

  it("應該使用新的 locale 調用 router.push", () => {
    const { result } = renderHook(() => useChangeLocale());
    const changeLocale = result.current;

    changeLocale("zh-TW");

    expect(mockPush).toHaveBeenCalledWith(mockPathname, { locale: "zh-TW" });
  });

  it("應該在切換 locale 後調用 router.refresh", () => {
    const { result } = renderHook(() => useChangeLocale());
    const changeLocale = result.current;

    changeLocale("en-US");

    expect(mockRefresh).toHaveBeenCalled();
  });

  it("應該按順序調用 push 和 refresh", () => {
    const callOrder: string[] = [];

    mockPush.mockImplementation(() => {
      callOrder.push("push");
    });

    mockRefresh.mockImplementation(() => {
      callOrder.push("refresh");
    });

    const { result } = renderHook(() => useChangeLocale());
    const changeLocale = result.current;

    changeLocale("en-US");

    expect(callOrder).toEqual(["push", "refresh"]);
  });
});
