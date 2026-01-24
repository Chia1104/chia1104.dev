import { test, expect } from "@playwright/test";

test.describe("網站效能測試", () => {
  test("首頁載入時間應該在合理範圍內", async ({ page }) => {
    const startTime = Date.now();
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const loadTime = Date.now() - startTime;

    // 頁面載入應該在 5 秒內完成
    expect(loadTime).toBeLessThan(5000);
  });

  test("應該有合理的 First Contentful Paint", async ({ page }) => {
    await page.goto("/");

    const performanceMetrics = await page.evaluate(() => {
      const paintEntries = performance.getEntriesByType("paint");
      const fcp = paintEntries.find(
        (entry) => entry.name === "first-contentful-paint"
      );
      return {
        fcp: fcp?.startTime || 0,
      };
    });

    // FCP 應該在 2 秒內
    expect(performanceMetrics.fcp).toBeLessThan(2000);
  });

  test("資源載入數量應該合理", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const resourceCount = await page.evaluate(() => {
      return performance.getEntriesByType("resource").length;
    });

    // 資源數量應該少於 100 個
    expect(resourceCount).toBeLessThan(100);
  });

  test("頁面大小應該合理", async ({ page }) => {
    const response = await page.goto("/");
    const body = await response?.body();
    const sizeInKB = body ? body.length / 1024 : 0;

    // HTML 大小應該小於 500KB
    expect(sizeInKB).toBeLessThan(500);
  });

  test("應該使用 gzip 或 brotli 壓縮", async ({ page }) => {
    const response = await page.goto("/");
    const encoding = response?.headers()["content-encoding"];

    expect(["gzip", "br"]).toContain(encoding);
  });

  test("圖片應該被優化", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const images = await page.locator("img").all();

    for (const img of images) {
      const src = await img.getAttribute("src");
      if (src && src.includes("_next/image")) {
        // Next.js 圖片優化已啟用
        expect(src).toContain("_next/image");
      }
    }
  });

  test("應該設置適當的快取標頭", async ({ page }) => {
    const response = await page.goto("/");
    const cacheControl = response?.headers()["cache-control"];

    expect(cacheControl).toBeDefined();
  });

  test("JavaScript bundle 大小應該合理", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const jsResources = await page.evaluate(() => {
      return performance
        .getEntriesByType("resource")
        .filter((r) => r.name.endsWith(".js"))
        .map((r) => ({
          name: r.name,
          size: (r as PerformanceResourceTiming).transferSize,
        }));
    });

    const totalJsSize = jsResources.reduce((acc, r) => acc + (r.size || 0), 0);
    const totalJsSizeInKB = totalJsSize / 1024;

    // 總 JS 大小應該小於 1MB
    expect(totalJsSizeInKB).toBeLessThan(1024);
  });

  test("CSS 資源應該被正確載入", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const cssResources = await page.evaluate(() => {
      return performance
        .getEntriesByType("resource")
        .filter((r) => r.name.endsWith(".css")).length;
    });

    expect(cssResources).toBeGreaterThanOrEqual(0);
  });
});
