import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
const { confirmNavigation } = await import("../src/libs/navigation-guard");
const { useLeaveGuard } =
  await import("../src/components/feed/use-leave-guard");

describe("draft leave guard", () => {
  beforeEach(() => navigation.push.mockReset());

  it("lets a synced editor go without saving", async () => {
    const flush = vi.fn<() => Promise<boolean>>();
    renderHook(() => useLeaveGuard({ isSynced: true, flush }));
    expect(await confirmNavigation("/feed/drafts")).toBe(true);
    expect(flush).not.toHaveBeenCalled();
    expect(
      window.dispatchEvent(new Event("beforeunload", { cancelable: true }))
    ).toBe(true);
  });

  it("saves before leaving and asks only when that fails", async () => {
    const flush = vi.fn<() => Promise<boolean>>().mockResolvedValue(true);
    const { result } = renderHook(() =>
      useLeaveGuard({ isSynced: false, flush })
    );
    expect(await confirmNavigation("/feed/drafts")).toBe(true);
    expect(flush).toHaveBeenCalledTimes(1);
    expect(result.current.blockedHref).toBeNull();

    flush.mockResolvedValue(false);
    let allowed = true;
    await act(async () => {
      allowed = await confirmNavigation("/feed/drafts");
    });
    expect(allowed).toBe(false);
    expect(result.current.blockedHref).toBe("/feed/drafts");

    act(() => result.current.stay());
    expect(result.current.blockedHref).toBeNull();
    expect(navigation.push).not.toHaveBeenCalled();

    await act(async () => {
      await confirmNavigation("/settings");
    });
    act(() => result.current.leave());
    expect(navigation.push).toHaveBeenCalledWith("/settings");
    expect(result.current.blockedHref).toBeNull();
  });

  it("asks the browser before the tab closes while unsynced", () => {
    const flush = vi.fn<() => Promise<boolean>>();
    const { rerender } = renderHook(
      ({ isSynced }: { isSynced: boolean }) =>
        useLeaveGuard({ isSynced, flush }),
      { initialProps: { isSynced: false } }
    );
    expect(
      window.dispatchEvent(new Event("beforeunload", { cancelable: true }))
    ).toBe(false);
    rerender({ isSynced: true });
    expect(
      window.dispatchEvent(new Event("beforeunload", { cancelable: true }))
    ).toBe(true);
  });
});
