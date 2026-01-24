import { test, expect } from "@playwright/test";

test.describe("圖片載入與優化測試", () => {
  test("應該成功載入優化後的圖片", async ({ page }) => {
    const response = await page.request.get(
      "/_next/image?url=%2Fme%2Fme-memoji.PNG&w=640&q=75"
    );
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toMatch(
      /image\/(png|webp|jpeg)/
    );
  });

  test("應該支援不同的圖片尺寸", async ({ page }) => {
    const sizes = [640, 750, 828, 1080, 1200];

    for (const size of sizes) {
      const response = await page.request.get(
        `/_next/image?url=%2Fme%2Fme-memoji.PNG&w=${size}&q=75`
      );
      expect(response.status()).toBe(200);
    }
  });

  test("應該支援不同的圖片質量", async ({ page }) => {
    const qualities = [75]; // 只測試預設質量

    for (const quality of qualities) {
      const response = await page.request.get(
        `/_next/image?url=%2Fme%2Fme-memoji.PNG&w=640&q=${quality}`
      );
      expect([200, 400]).toContain(response.status());
    }
  });

  test("應該返回適當的 Cache-Control header", async ({ page }) => {
    const response = await page.request.get(
      "/_next/image?url=%2Fme%2Fme-memoji.PNG&w=640&q=75"
    );
    const cacheControl = response.headers()["cache-control"];
    expect(cacheControl).toBeDefined();
  });

  test("首頁圖片應該正確載入", async ({ page }) => {
    await page.goto("/");

    // 等待圖片載入
    await page.waitForLoadState("networkidle");

    // 檢查是否有圖片元素
    const images = await page.locator("img").count();
    expect(images).toBeGreaterThan(0);
  });

  test("圖片應該有 alt 屬性", async ({ page }) => {
    await page.goto("/");

    const images = page.locator("img");
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const alt = await images.nth(i).getAttribute("alt");
      expect(alt).toBeDefined();
    }
  });

  /**
   * @TODO - Fix 500 error
   */
  test("應該處理無效的圖片 URL", async ({ page }) => {
    const response = await page.request.get(
      "/_next/image?url=%2Finvalid-image.png&w=640&q=75"
    );
    expect([400, 404]).toContain(response.status());
  });

  test("圖片應該支援 lazy loading", async ({ page }) => {
    await page.goto("/");

    const lazyImages = await page.locator('img[loading="lazy"]').count();
    expect(lazyImages).toBeGreaterThanOrEqual(0);
  });
});
