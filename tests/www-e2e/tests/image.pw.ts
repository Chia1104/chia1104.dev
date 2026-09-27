import { test, expect } from "@playwright/test";

test.describe("圖片載入測試", () => {
  test("Next.js 內建圖片優化 API 應該停用", async ({ page }) => {
    const response = await page.request.get(
      "/_next/image?url=%2Fassets%2Ffumadocs.png&w=640&q=75"
    );
    expect(response.status()).toBe(404);
  });

  test("public 靜態圖片應該直接提供", async ({ page }) => {
    const response = await page.request.get("/assets/fumadocs.png");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
  });

  // /cdn-cgi/image 只存在於 Cloudflare 代理的 production zone，e2e 的建置不是 production。
  test("next/image 在非 production 環境應該直接使用原圖", async ({ page }) => {
    await page.goto("/");

    const images = page.locator("img[data-nimg]");
    await expect(images.first()).toBeAttached();

    for (const image of await images.all()) {
      const src = await image.getAttribute("src");
      expect(src).toBeTruthy();
      expect(src).not.toMatch(/\/_next\/image|\/cdn-cgi\/image/);
      expect(await image.getAttribute("srcset")).toBeNull();
    }
  });
});
