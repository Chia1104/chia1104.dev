import { describe, expect, it } from "vitest";

import cloudflareImageLoader from "@/libs/image-loader";

describe("cloudflareImageLoader", () => {
  it("resizes a same-origin path through /cdn-cgi/image", () => {
    expect(
      cloudflareImageLoader({
        src: "/assets/fumadocs.png",
        width: 640,
        quality: 80,
      })
    ).toBe(
      "/cdn-cgi/image/width=640,quality=80,format=auto/assets/fumadocs.png"
    );
  });

  it("resizes a remote source with the default quality", () => {
    expect(
      cloudflareImageLoader({
        src: "https://storage.chia1104.dev/me.jpeg",
        width: 1080,
      })
    ).toBe(
      "/cdn-cgi/image/width=1080,quality=75,format=auto/https://storage.chia1104.dev/me.jpeg"
    );
  });

  it.each([
    "https://storage.chia1104.dev/feeds/why-turborepo-solution.avif",
    "/assets/cover.AVIF?v=2",
  ])("serves the AVIF source %s as-is", (src) => {
    expect(cloudflareImageLoader({ src, width: 640 })).toBe(src);
  });
});
