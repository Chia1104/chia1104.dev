import type { FeedType, Locale } from "@chia/db/types";

export const mockFeed = {
  id: "test-feed-1",
  slug: "test-post-slug",
  title: "測試文章標題",
  description: "這是一個測試文章描述",
  content: "# 測試內容\n\n這是測試文章的內容。",
  type: /* SAFETY: This fixture implements the FeedType members exercised by this case. */ "post" as FeedType,
  locale:
    /* SAFETY: This fixture implements the Locale members exercised by this case. */ "zh-TW" as Locale,
  published: true,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-02"),
};

export const mockFeeds = [
  mockFeed,
  {
    ...mockFeed,
    id: "test-feed-2",
    slug: "test-post-slug-2",
    title: "測試文章標題 2",
  },
  {
    ...mockFeed,
    id: "test-feed-3",
    slug: "test-note-slug",
    title: "測試筆記標題",
    type: /* SAFETY: This fixture implements the FeedType members exercised by this case. */ "note" as FeedType,
  },
];

export const mockEmail = {
  email: "test@example.com",
  title: "測試郵件標題",
  message: "這是一個測試郵件訊息",
  captchaToken: "test-captcha-token",
};

export const mockContact = {
  ...mockEmail,
};

export const mockSpotifyTrack = {
  id: "track-123",
  name: "Test Song",
  artists: [{ name: "Test Artist" }],
  album: {
    name: "Test Album",
    images: [{ url: "https://example.com/image.jpg" }],
  },
  external_urls: {
    spotify: "https://open.spotify.com/track/123",
  },
};

export const mockGitHubRepo = {
  id: 123456,
  name: "test-repo",
  full_name: "chia1104/test-repo",
  description: "A test repository",
  html_url: "https://github.com/chia1104/test-repo",
  stargazers_count: 100,
  forks_count: 50,
  language: "TypeScript",
  topics: ["react", "nextjs"],
};
