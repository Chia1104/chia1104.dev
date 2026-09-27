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
    test("首頁 og:image 應該可以直接載入", async ({ page }) => {
      await page.goto("/");
      const content = await page
        .locator('meta[property="og:image"]')
        .first()
        .getAttribute("content");
      expect(content).toBeTruthy();

      // metadataBase 可能是正式站網址，只取路徑打測試中的 server。
      const { pathname, search } = new URL(content ?? "");
      const response = await page.request.get(`${pathname}${search}`, {
        maxRedirects: 0,
      });
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain("image");
      // 帶 NEXT_LOCALE cookie 的回應無法被 Cloudflare edge cache。
      expect(response.headers()["set-cookie"]).toBeUndefined();
      expect((await response.body()).length).toBeGreaterThan(1000);
    });
  });

  test.describe("Sitemap", () => {
    test("應該成功載入 sitemap", async ({ page }) => {
      const response = await page.request.get("/sitemap.xml");
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain("xml");
    });

    test("sitemap 應該包含有效的 URL", async ({ page }) => {
      const response = await page.request.get("/sitemap.xml");
      const text = await response.text();

      expect(text).toContain("<urlset");
      expect(text).toContain("<url>");
      expect(text).toContain("<loc>");
    });

    test("sitemap 應該包含 lastmod", async ({ page }) => {
      const response = await page.request.get("/sitemap.xml");
      const text = await response.text();

      expect(text).toContain("<lastmod>");
    });

    test("sitemap 不應該列出會轉址的預設語系前綴", async ({ page }) => {
      const response = await page.request.get("/sitemap.xml");
      const locs = (await response.text()).match(/<loc>[^<]*<\/loc>/g) ?? [];

      expect(locs.length).toBeGreaterThan(0);
      for (const loc of locs) {
        expect(loc).not.toContain("/zh-TW");
      }
    });

    test("sitemap 應該標示語系替代網址", async ({ page }) => {
      const response = await page.request.get("/sitemap.xml");
      const text = await response.text();

      expect(text).toContain('hreflang="en-US"');
      expect(text).toContain('hreflang="zh-TW"');
    });
  });

  test.describe("RSS", () => {
    test("應該成功載入預設語系與英文的 RSS", async ({ page }) => {
      for (const path of ["/rss.xml", "/en-US/rss.xml"]) {
        const response = await page.request.get(path, { maxRedirects: 0 });
        expect(response.status()).toBe(200);
        expect(response.headers()["content-type"]).toContain(
          "application/rss+xml"
        );
        expect(await response.text()).toContain("<rss");
      }
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

    test("canonical 與 hreflang 應該指向不帶預設語系前綴的網址", async ({
      page,
    }) => {
      await page.goto("/en-US/posts");

      const canonical = await page
        .locator('link[rel="canonical"]')
        .getAttribute("href");
      expect(new URL(canonical ?? "").pathname).toBe("/en-US/posts");

      const zhTW = await page
        .locator('link[rel="alternate"][hreflang="zh-TW"]')
        .getAttribute("href");
      expect(new URL(zhTW ?? "").pathname).toBe("/posts");

      await expect(
        page.locator('link[rel="alternate"][hreflang="x-default"]')
      ).toHaveCount(1);
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
    test("首頁應該以 JSON-LD 描述網站與作者", async ({ page }) => {
      await page.goto("/");
      const jsonLd = await page
        .locator('script[type="application/ld+json"]')
        .first()
        .textContent();

      expect(jsonLd).toContain('"@type":"WebSite"');
      expect(jsonLd).toContain('"@type":"Person"');
    });
  });
});
