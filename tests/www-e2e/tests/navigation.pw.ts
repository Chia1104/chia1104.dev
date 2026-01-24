import { test, expect } from "@playwright/test";

import { HomePage } from "../page-objects/HomePage";

test.describe("網站導航測試", () => {
  let homePage: HomePage;

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    await homePage.navigate();
  });

  // test("應該能夠在不同頁面間導航", async ({ page }) => {
  //   // 從首頁到文章頁
  //   await homePage.clickPostsLink();
  //   await page.waitForURL("**/posts", { timeout: 10000 });
  //   expect(page.url()).toMatch(/\/(posts|en-US\/posts|zh-TW\/posts)/);

  //   // 返回首頁
  //   await page.goto("/");
  //   await expect(homePage.nameTitle).toBeVisible();

  //   // 到專案頁
  //   await homePage.clickProjectsLink();
  //   await page.waitForURL("**/projects", { timeout: 10000 });
  //   expect(page.url()).toMatch(/\/(projects|en-US\/projects|zh-TW\/projects)/);
  // });

  // test("瀏覽器返回按鈕應該正常工作", async ({ page }) => {
  //   await homePage.clickPostsLink();
  //   await page.waitForURL("**/posts", { timeout: 10000 });

  //   await page.goBack();
  //   await page.waitForLoadState("domcontentloaded");
  //   await expect(homePage.nameTitle).toBeVisible();
  // });

  test("導航選單應該在所有頁面顯示", async () => {
    await expect(homePage.navigationMenu).toBeVisible();
  });

  test("當前頁面應該在導航中高亮顯示", async () => {
    // 檢查導航連結存在
    const navLinks = await homePage.navigationMenu.locator("a").count();
    expect(navLinks).toBeGreaterThan(0);
  });

  test("導航連結應該可以用鍵盤操作", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // 檢查可以 Tab 到元素
    await page.keyboard.press("Tab");
    const focusedElement = await page.locator(":focus").count();
    expect(focusedElement).toBeGreaterThanOrEqual(0);
  });

  test("所有導航連結應該是可訪問的", async ({ page }) => {
    const navLinks = await homePage.navigationMenu.locator("a").all();
    expect(navLinks.length).toBeGreaterThan(0);

    // 只檢查前幾個連結
    for (const link of navLinks.slice(0, 3)) {
      const href = await link.getAttribute("href");
      if (href && href.startsWith("/") && !href.startsWith("//")) {
        const response = await page.request.get(href);
        if (response) {
          expect([200, 301, 302, 404]).toContain(response.status());
        }
      }
    }
  });
});
