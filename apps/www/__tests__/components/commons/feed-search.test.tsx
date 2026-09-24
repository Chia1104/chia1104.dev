import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FeedSearch } from "@/components/commons/feed-search";
import { useSearchFeeds } from "@/hooks/use-search-feeds";

import { renderWithProviders } from "../../utils";

const { mockPush } = vi.hoisted(() => ({
  mockPush: vi.fn(),
}));

vi.mock("@/hooks/use-search-feeds", () => ({
  useSearchFeeds: vi.fn(),
}));

vi.mock("@/libs/i18n/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

const mockUseSearchFeeds = vi.mocked(useSearchFeeds);

const mockSearchResult = (
  result: Partial<ReturnType<typeof useSearchFeeds>>
) => {
  // @ts-expect-error Each fixture supplies only the query-state fields its scenario exercises.
  mockUseSearchFeeds.mockReturnValue(result);
};

function renderSearch() {
  return renderWithProviders(
    <FeedSearch query="test" locale="zh-TW" onSelect={vi.fn()} />
  );
}

describe("FeedSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a loading status while searching", () => {
    mockSearchResult({
      debouncedKeyword: "test",
      canSearch: true,
      isPending: true,
      isFetching: true,
    });

    renderSearch();

    expect(screen.getByText("search-loading")).toBeInTheDocument();
  });

  it("renders an error message when search fails", () => {
    mockSearchResult({
      debouncedKeyword: "test",
      canSearch: true,
      isPending: false,
      isFetching: false,
      isError: true,
    });

    renderSearch();

    expect(screen.getByRole("alert")).toHaveTextContent("search-error");
  });

  it("renders an empty state when no feed matches", () => {
    mockSearchResult({
      debouncedKeyword: "test",
      canSearch: true,
      isPending: false,
      isFetching: false,
      isError: false,
      data: { items: [] },
    });

    renderSearch();

    expect(screen.getByText("no-results")).toBeInTheDocument();
  });

  it("navigates to the selected localized feed", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    mockSearchResult({
      debouncedKeyword: "test",
      canSearch: true,
      isPending: false,
      isFetching: false,
      isError: false,
      data: {
        items: [
          {
            feedId: 1,
            type: "post",
            slug: "hello-world",
            locale: "zh-TW",
            title: "Hello world",
            description: "Description",
            excerpt: "",
          },
        ],
      },
    });

    renderWithProviders(
      <FeedSearch query="test" locale="zh-TW" onSelect={onSelect} />
    );
    await user.click(screen.getByText("Hello world"));

    expect(mockPush).toHaveBeenCalledWith("/posts/hello-world", {
      locale: "zh-TW",
    });
    expect(onSelect).toHaveBeenCalledOnce();
  });
});
