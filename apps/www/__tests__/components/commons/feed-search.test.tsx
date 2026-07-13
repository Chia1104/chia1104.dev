import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Command, CommandList } from "@chia/ui/cmd";

import { FeedSearch } from "@/components/commons/feed-search";
import { useSearchFeeds } from "@/hooks/use-search-feeds";

import { renderWithProviders } from "../../utils";

const { mockPush } = vi.hoisted(() => ({
  mockPush: vi.fn(),
}));

vi.mock("@/hooks/use-search-feeds", () => ({
  useSearchFeeds: vi.fn(),
}));

vi.mock("@/libs/i18n/routing", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

const mockUseSearchFeeds = vi.mocked(useSearchFeeds);

function renderSearch() {
  return renderWithProviders(
    <Command shouldFilter={false}>
      <CommandList>
        <FeedSearch query="test" locale="zh-TW" onSelect={vi.fn()} />
      </CommandList>
    </Command>
  );
}

describe("FeedSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render a loading status while searching", () => {
    mockUseSearchFeeds.mockReturnValue({
      debouncedKeyword: "test",
      canSearch: true,
      isPending: true,
      isFetching: true,
    } as unknown as ReturnType<typeof useSearchFeeds>);

    renderSearch();

    expect(screen.getByText("search-loading")).toBeInTheDocument();
  });

  it("should render an error message when search fails", () => {
    mockUseSearchFeeds.mockReturnValue({
      debouncedKeyword: "test",
      canSearch: true,
      isPending: false,
      isFetching: false,
      isError: true,
    } as unknown as ReturnType<typeof useSearchFeeds>);

    renderSearch();

    expect(screen.getByRole("alert")).toHaveTextContent("search-error");
  });

  it("should render an empty state when no feed matches", () => {
    mockUseSearchFeeds.mockReturnValue({
      debouncedKeyword: "test",
      canSearch: true,
      isPending: false,
      isFetching: false,
      isError: false,
      data: { items: [] },
    } as unknown as ReturnType<typeof useSearchFeeds>);

    renderSearch();

    expect(screen.getByText("no-results")).toBeInTheDocument();
  });

  it("should navigate to the selected localized feed", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    mockUseSearchFeeds.mockReturnValue({
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
    } as unknown as ReturnType<typeof useSearchFeeds>);

    renderWithProviders(
      <Command shouldFilter={false}>
        <CommandList>
          <FeedSearch query="test" locale="zh-TW" onSelect={onSelect} />
        </CommandList>
      </Command>
    );
    await user.click(screen.getByText("Hello world"));

    expect(mockPush).toHaveBeenCalledWith("/posts/hello-world", {
      locale: "zh-TW",
    });
    expect(onSelect).toHaveBeenCalledOnce();
  });
});
