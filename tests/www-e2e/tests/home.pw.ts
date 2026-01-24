import { test, expect } from "@playwright/test";

import { TEST_METADATA } from "../fixtures/test-data";
import { HomePage } from "../page-objects/HomePage";

test.describe("首頁測試", () => {
  let homePage: HomePage;

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    await homePage.navigate();
  });

  test("應該顯示正確的名稱", async () => {
    await expect(homePage.nameTitle).toHaveText(TEST_METADATA.SITE_NAME);
  });

  test("應該載入並顯示主要內容", async () => {
    await homePage.verifyPageLoaded();
    await expect(homePage.nameTitle).toBeVisible();
  });

  test("應該顯示導航選單", async () => {
    await expect(homePage.navigationMenu).toBeVisible();
  });

  test("應該顯示頁尾", async () => {
    await expect(homePage.footer).toBeVisible();
  });

  test("應該有正確的頁面標題", async ({ page }) => {
    const title = await page.title();
    expect(title).toContain(TEST_METADATA.DEFAULT_TITLE);
  });

  test("頁面應該可訪問（基本 a11y 檢查）", async ({ page }) => {
    // 檢查基本的可訪問性元素
    await expect(homePage.mainContent).toBeVisible();

    // 檢查 heading 存在
    const headings = page.locator("h1, h2, h3");
    expect(await headings.count()).toBeGreaterThan(0);
  });
});
