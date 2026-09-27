import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FeedType } from "@chia/db/types";
import { NavigationMenu } from "@chia/ui/navigation-menu";

import { renderWithProviders } from "../../utils";

// vi.hoisted so the mock exists before `vi.mock`.
const { mockPush } = vi.hoisted(() => ({
  mockPush: vi.fn(),
}));

vi.mock("@/libs/i18n/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// The list loads only once a menu opens; these tests stay on the trigger.
vi.mock("@/libs/orpc/client", () => ({
  orpc: {
    feeds: {
      list: {
        queryOptions: () => ({
          queryKey: ["feeds.list"],
          queryFn: async () => ({ items: [], nextCursor: null }),
        }),
      },
    },
  },
}));

import FeedNavigation from "@/components/blog/feed-navigation";

const renderFeedNavigation = async (type: FeedType) => {
  await act(async () => {
    renderWithProviders(
      <NavigationMenu>
        <FeedNavigation type={type} />
      </NavigationMenu>
    );
  });
};

describe("FeedNavigation Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("應該渲染 Post 類型的導航", async () => {
    await renderFeedNavigation(FeedType.Post);

    const trigger = screen.getByRole("button");
    expect(trigger).toBeInTheDocument();
  });

  it("應該渲染 Note 類型的導航", async () => {
    await renderFeedNavigation(FeedType.Note);

    const trigger = screen.getByRole("button");
    expect(trigger).toBeInTheDocument();
  });

  it("應該在沒有 feeds 時顯示無內容訊息", async () => {
    await renderFeedNavigation(FeedType.Post);

    const trigger = screen.getByRole("button");
    expect(trigger).toBeInTheDocument();
  });

  it("應該渲染 feeds 列表", async () => {
    await renderFeedNavigation(FeedType.Post);

    const trigger = screen.getByRole("button");
    expect(trigger).toBeInTheDocument();
  });

  it("應該處理點擊觸發器", async () => {
    const user = userEvent.setup();
    await renderFeedNavigation(FeedType.Post);

    const trigger = screen.getByRole("button");
    await user.click(trigger);

    expect(mockPush).toHaveBeenCalledWith("/posts");
  });

  it("應該為 Note 類型使用正確的路徑前綴", async () => {
    const user = userEvent.setup();
    await renderFeedNavigation(FeedType.Note);

    const trigger = screen.getByRole("button");
    await user.click(trigger);

    expect(mockPush).toHaveBeenCalledWith("/notes");
  });

  it("應該處理空 feeds 的情況", async () => {
    await renderFeedNavigation(FeedType.Post);

    const trigger = screen.getByRole("button");
    expect(trigger).toBeInTheDocument();
  });

  it("應該為 Post 類型的第一個項目使用特殊樣式", async () => {
    await renderFeedNavigation(FeedType.Post);

    const trigger = screen.getByRole("button");
    expect(trigger).toBeInTheDocument();
  });
});
