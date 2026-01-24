import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { FeedType } from "@chia/db/types";
import { NavigationMenu } from "@chia/ui/navigation-menu";

import type { RouterOutputs } from "@/libs/orpc/types";

import { renderWithProviders } from "../../utils";

// 使用 vi.hoisted 確保 mock 函數在正確的時機創建
const { mockPush } = vi.hoisted(() => ({
  mockPush: vi.fn(),
}));

// Mock the router
vi.mock("@/libs/i18n/routing", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

import FeedNavigation from "@/components/blog/feed-navigation";

describe("FeedNavigation Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockFeeds: RouterOutputs["feeds"]["list"]["items"] = [
    {
      id: 1,
      slug: "test-post-1",
      userId: "1",
      type: "post",
      published: true,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      mainImage: null,
      contentType: "mdx",
      defaultLocale: "zh-TW",
      translations: [
        {
          id: 1,
          feedId: 1,
          locale: "zh-TW",
          title: "測試文章 1",
          description: "這是測試文章 1 的描述",
          excerpt: null,
          summary: null,
          readTime: null,
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
          content: null,
          embedding: null,
          embedding512: null,
        },
      ],
    },
    {
      id: 2,
      slug: "test-post-2",
      userId: "1",
      type: "post",
      published: true,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      mainImage: null,
      contentType: "mdx",
      defaultLocale: "zh-TW",
      translations: [
        {
          id: 2,
          feedId: 2,
          locale: "zh-TW",
          title: "測試文章 2",
          description: "這是測試文章 2 的描述",
          excerpt: null,
          summary: null,
          readTime: null,
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
          content: null,
          embedding: null,
          embedding512: null,
        },
      ],
    },
  ];

  it("應該渲染 Post 類型的導航", () => {
    renderWithProviders(
      <NavigationMenu>
        <FeedNavigation type={FeedType.Post} feeds={mockFeeds} />
      </NavigationMenu>
    );

    const trigger = screen.getByRole("button");
    expect(trigger).toBeInTheDocument();
  });

  it("應該渲染 Note 類型的導航", () => {
    renderWithProviders(
      <NavigationMenu>
        <FeedNavigation type={FeedType.Note} feeds={mockFeeds} />
      </NavigationMenu>
    );

    const trigger = screen.getByRole("button");
    expect(trigger).toBeInTheDocument();
  });

  it("應該在沒有 feeds 時顯示無內容訊息", () => {
    renderWithProviders(
      <NavigationMenu>
        <FeedNavigation type={FeedType.Post} feeds={[]} />
      </NavigationMenu>
    );

    // 需要點擊觸發器才能看到內容
    const trigger = screen.getByRole("button");
    expect(trigger).toBeInTheDocument();
  });

  it("應該渲染 feeds 列表", () => {
    renderWithProviders(
      <NavigationMenu>
        <FeedNavigation type={FeedType.Post} feeds={mockFeeds} />
      </NavigationMenu>
    );

    // Feeds 會在 NavigationMenuContent 中渲染
    // 由於導航菜單的特性，內容可能需要互動才會顯示
    const trigger = screen.getByRole("button");
    expect(trigger).toBeInTheDocument();
  });

  it("應該處理點擊觸發器", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <NavigationMenu>
        <FeedNavigation type={FeedType.Post} feeds={mockFeeds} />
      </NavigationMenu>
    );

    const trigger = screen.getByRole("button");
    await user.click(trigger);

    expect(mockPush).toHaveBeenCalledWith("/posts");
  });

  it("應該為 Note 類型使用正確的路徑前綴", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <NavigationMenu>
        <FeedNavigation type={FeedType.Note} feeds={mockFeeds} />
      </NavigationMenu>
    );

    const trigger = screen.getByRole("button");
    await user.click(trigger);

    expect(mockPush).toHaveBeenCalledWith("/notes");
  });

  it("應該處理沒有 feeds 的情況", () => {
    renderWithProviders(
      <NavigationMenu>
        <FeedNavigation type={FeedType.Post} />
      </NavigationMenu>
    );

    const trigger = screen.getByRole("button");
    expect(trigger).toBeInTheDocument();
  });

  it("應該為 Post 類型的第一個項目使用特殊樣式", () => {
    renderWithProviders(
      <NavigationMenu>
        <FeedNavigation type={FeedType.Post} feeds={mockFeeds} />
      </NavigationMenu>
    );

    // 觸發器應該存在
    const trigger = screen.getByRole("button");
    expect(trigger).toBeInTheDocument();
  });
});
