import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";

import { Locale } from "@chia/db/types";

import { useSearchFeeds } from "@/hooks/use-search-feeds";
import { client } from "@/libs/service/client";

import { createTestQueryClient } from "../utils";

vi.mock("@/libs/service/client", () => ({
  client: {
    api: {
      v1: {
        feeds: {
          public: {
            search: {
              $get: vi.fn(),
            },
          },
        },
      },
    },
  },
}));

const mockSearch = client.api.v1.feeds.public.search.$get as ReturnType<
  typeof vi.fn
>;

describe("useSearchFeeds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearch.mockResolvedValue(Response.json({ items: [] }));
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
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("should search through the shared service client", async () => {
    const queryClient = createTestQueryClient();

    renderHook(() => useSearchFeeds("React", Locale.En), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
    });

    await waitFor(() => {
      expect(mockSearch).toHaveBeenCalledWith(
        {
          query: {
            keyword: "React",
            locale: Locale.En,
          },
        },
        {
          init: {
            signal: expect.any(AbortSignal),
          },
        }
      );
    });
  });
});
