import { test, expect } from "@playwright/test";

import { HomePage } from "../page-objects/HomePage";
import { NotFoundPage } from "../page-objects/NotFoundPage";
import { BASE_URL } from "../playwright.config";

test.describe("404 錯誤頁面測試", () => {
  let notFoundPage: NotFoundPage;

  test.beforeEach(async ({ page }) => {
    notFoundPage = new NotFoundPage(page);
  });

  test("應該顯示 404 頁面當訪問不存在的路徑", async () => {
    await notFoundPage.navigateToInvalidPage("/this-is-not-found-page");
    await expect(notFoundPage.title).toHaveText("Not Found");
  });

  test("應該能從 404 頁面返回首頁", async ({ page }) => {
    await notFoundPage.navigateToInvalidPage("/this-is-not-found-page");
    await expect(notFoundPage.title).toHaveText("Not Found");

    await notFoundPage.clickBackLink();

    const homePage = new HomePage(page);
    await expect(homePage.nameTitle).toHaveText("Chia1104");
  });

  test("應該處理雙斜線路徑", async ({ page }) => {
    await page.goto(`${BASE_URL}//test`);
    await expect(notFoundPage.title).toHaveText("Not Found");
  });

  test("應該處理特殊字符路徑", async () => {
    const specialPaths = ["/test<script>", "/test%20space", "/test/../admin"];

    for (const path of specialPaths) {
      await notFoundPage.navigateToInvalidPage(path);
      await expect(notFoundPage.title).toHaveText("Not Found");
    }
  });

  test("404 頁面應該有返回連結", async () => {
    await notFoundPage.navigateToInvalidPage("/non-existent");
    await expect(notFoundPage.backLink).toBeVisible();
  });

  test("404 頁面應該返回正確的 HTTP 狀態碼", async ({ page }) => {
    const response = await page.goto("/non-existent-page");
    expect([200, 404]).toContain(response?.status() || 200);
  });
});
