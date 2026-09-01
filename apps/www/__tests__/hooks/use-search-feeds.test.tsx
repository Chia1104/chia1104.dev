import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";

import { Locale } from "@chia/db/types";

import { useSearchFeeds } from "@/hooks/use-search-feeds";
import { orpc } from "@/libs/orpc/client";

import { createTestQueryClient } from "../utils";

const { mockQueryFn, mockQueryOptions } = vi.hoisted(() => {
  const queryFn = vi.fn();
  return {
    mockQueryFn: queryFn,
    // Fake oRPC queryOptions so the hook still runs through react-query.
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

  it("should debounce query changes for 300 milliseconds", async () => {
    vi.useFakeTimers();
    const queryClient = createTestQueryClient();
    const { result, rerender } = renderHook(
      ({ value }) => useSearchFeeds(value, Locale.zhTW),
      {
        initialProps: { value: "first" },
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        ),
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

  it("should not request a one-character query", () => {
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useSearchFeeds("x", Locale.zhTW), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
    });

    expect(result.current.canSearch).toBe(false);
    expect(mockQueryFn).not.toHaveBeenCalled();
  });

  it("should search through the oRPC query options", async () => {
    const queryClient = createTestQueryClient();

    renderHook(() => useSearchFeeds("React", Locale.En), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
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
