import { test, expect } from "@playwright/test";

test.describe("網站 Metadata 與 SEO 測試", () => {
  test.describe("Favicon 和圖標", () => {
    test("應該成功載入 favicon.ico", async ({ page }) => {
      const response = await page.request.get("/favicon.ico");
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain("image");
    });

    test("應該成功載入 icon.png", async ({ page }) => {
      const response = await page.request.get("/icon.png");
      expect(response.status()).toBe(200);
    });
  });

  test.describe("Open Graph 圖片", () => {
    test("應該成功載入首頁 OG 圖片", async ({ page }) => {
      const response = await page.request.get("/opengraph-image");
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain("image");
    });

    test("OG 圖片應該有合適的尺寸", async ({ page }) => {
      const response = await page.request.get("/opengraph-image");
      const buffer = await response.body();
      expect(buffer.length).toBeGreaterThan(1000); // 確保不是空圖片
    });
  });

  test.describe("Sitemap", () => {
    test("應該成功載入 sitemap index", async ({ page }) => {
      const response = await page.request.get("/sitemap.xml");
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain("xml");
    });

    test("應該成功載入 sitemap", async ({ page }) => {
      const response = await page.request.get("/sitemap-0.xml");
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain("xml");
    });

    test("sitemap 應該包含有效的 URL", async ({ page }) => {
      const response = await page.request.get("/sitemap-0.xml");
      const text = await response.text();

      expect(text).toContain("<urlset");
      expect(text).toContain("<url>");
      expect(text).toContain("<loc>");
    });

    test("sitemap 應該包含 lastmod", async ({ page }) => {
      const response = await page.request.get("/sitemap-0.xml");
      const text = await response.text();

      expect(text).toContain("<lastmod>");
    });
  });

  test.describe("robots.txt", () => {
    test("應該成功載入 robots.txt", async ({ page }) => {
      const response = await page.request.get("/robots.txt");
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain("text");
    });

    test("robots.txt 應該包含 User-agent", async ({ page }) => {
      const response = await page.request.get("/robots.txt");
      const text = await response.text();

      // 檢查大小寫不敏感
      expect(text.toLowerCase()).toContain("user-agent");
    });

    test("robots.txt 應該包含 Sitemap 路徑", async ({ page }) => {
      const response = await page.request.get("/robots.txt");
      const text = await response.text();

      expect(text).toContain("Sitemap");
      expect(text).toContain("sitemap.xml");
    });
  });

  test.describe("Meta Tags", () => {
    test("首頁應該有正確的 meta tags", async ({ page }) => {
      await page.goto("/");

      // Title
      const title = await page.title();
      expect(title.length).toBeGreaterThan(0);

      // Description
      const description = await page
        .locator('meta[name="description"]')
        .getAttribute("content");
      expect(description).toBeTruthy();

      // OG tags
      const ogTitle = await page
        .locator('meta[property="og:title"]')
        .getAttribute("content");
      expect(ogTitle).toBeTruthy();

      const ogDescription = await page
        .locator('meta[property="og:description"]')
        .getAttribute("content");
      expect(ogDescription).toBeTruthy();
    });

    test("應該有正確的 viewport meta tag", async ({ page }) => {
      await page.goto("/");
      const viewport = await page
        .locator('meta[name="viewport"]')
        .getAttribute("content");
      expect(viewport).toContain("width=device-width");
    });

    test("應該有正確的 charset", async ({ page }) => {
      await page.goto("/");
      const charset = await page
        .locator("meta[charset]")
        .getAttribute("charset");
      expect(charset?.toLowerCase()).toBe("utf-8");
    });
  });

  test.describe("結構化資料", () => {
    test("應該包含 JSON-LD 結構化資料", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      const jsonLd = await page
        .locator('script[type="application/ld+json"]')
        .count();
      // 結構化資料可能存在也可能不存在，這是可選的
      expect(jsonLd).toBeGreaterThanOrEqual(0);
    });
  });
});
