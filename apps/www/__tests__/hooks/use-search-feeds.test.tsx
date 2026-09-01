import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import { Locale } from "@chia/db/types";

import { useSearchFeeds } from "@/hooks/use-search-feeds";
import { orpc } from "@/libs/orpc/client";

import { withQueryClient } from "../utils";

const { mockQueryFn, mockQueryOptions } = vi.hoisted(() => {
  const queryFn = vi.fn();
  return {
    mockQueryFn: queryFn,
    mockQueryOptions: vi.fn(
      ({ input }: { input: { keyword: string; locale: string } }) => ({
        queryKey: ["feeds", "search", input],
        queryFn: () => queryFn(input),
      })
    ),
  };
});

vi.mock("@/libs/orpc/client", () => ({
  orpc: {
    feeds: {
      search: { queryOptions: mockQueryOptions },
    },
  },
}));

describe("useSearchFeeds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryFn.mockResolvedValue({ items: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces query changes for 300 milliseconds", async () => {
    vi.useFakeTimers();
    const { wrapper } = withQueryClient();
    const { result, rerender } = renderHook(
      ({ value }) => useSearchFeeds(value, Locale.zhTW),
      {
        initialProps: { value: "first" },
        wrapper,
      }
    );

    rerender({ value: "second" });
    expect(result.current.debouncedKeyword).toBe("first");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(299);
    });
    expect(result.current.debouncedKeyword).toBe("first");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(result.current.debouncedKeyword).toBe("second");
  });

  it("does not request a one-character query", () => {
    const { wrapper } = withQueryClient();

    const { result } = renderHook(() => useSearchFeeds("x", Locale.zhTW), {
      wrapper,
    });

    expect(result.current.canSearch).toBe(false);
    expect(mockQueryFn).not.toHaveBeenCalled();
  });

  it("searches through the oRPC query options", async () => {
    const { wrapper } = withQueryClient();

    renderHook(() => useSearchFeeds("React", Locale.En), {
      wrapper,
    });

    await waitFor(() => {
      expect(orpc.feeds.search.queryOptions).toHaveBeenCalledWith({
        input: { keyword: "React", locale: Locale.En },
      });
      expect(mockQueryFn).toHaveBeenCalledWith({
        keyword: "React",
        locale: Locale.En,
      });
    });
  });
});
