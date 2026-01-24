import { http, HttpResponse } from "msw";

import type { mockEmail } from "./data";
import { mockFeeds } from "./data";

export const handlers = [
  // Mock feeds API
  http.get("*/api/v1/admin/public/feeds", ({ request }) => {
    const url = new URL(request.url);
    const type = url.searchParams.get("type");
    const limit = Number.parseInt(url.searchParams.get("limit") || "10");

    let filteredFeeds = mockFeeds;
    if (type && type !== "all") {
      filteredFeeds = mockFeeds.filter((feed) => feed.type === type);
    }

    return HttpResponse.json({
      data: filteredFeeds.slice(0, limit),
      total: filteredFeeds.length,
    });
  }),

  // Mock single feed API
  http.get("*/api/v1/admin/public/feeds/:slug", ({ params }) => {
    const { slug } = params;
    const feed = mockFeeds.find((f) => f.slug === slug);

    if (!feed) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json({ data: feed });
  }),

  // Mock email send API
  http.post("*/api/v1/email/send", async ({ request }) => {
    const body = (await request.json()) as typeof mockEmail;

    // 驗證必要欄位
    if (!body.email || !body.title || !body.message) {
      return HttpResponse.json(
        {
          code: "VALIDATION_ERROR",
          errors: [{ message: "Missing required fields" }],
        },
        { status: 400 }
      );
    }

    return HttpResponse.json({
      success: true,
      message: "Email sent successfully",
    });
  }),

  // Mock Spotify current playing API
  http.get("*/api/v1/spotify/current-playing", () => {
    return HttpResponse.json({
      isPlaying: true,
      track: {
        name: "Test Song",
        artist: "Test Artist",
        albumArt: "https://example.com/image.jpg",
      },
    });
  }),
];
