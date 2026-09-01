import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.hoisted so the mock exists before `vi.mock`.
const { mockPush, mockRefresh, mockPathname } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockRefresh: vi.fn(),
  mockPathname: "/test-path",
}));

vi.mock("@/libs/i18n/navigation", () => ({
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
    expect(result.current).toEqual(expect.any(Function));
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
