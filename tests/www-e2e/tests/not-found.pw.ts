import { test, expect } from "@playwright/test";

test("not-found page", async ({ page }) => {
  await page.goto("/this-is-not-found-page");
  const title = page.locator("h2");
  await expect(title).toHaveText("Not Found");
  const link = page.getByText("cd ../");
  await link.click({
    clickCount: 2,
  });
  await page.waitForTimeout(3000);
  page.url().includes("/this-is-not-found-page") &&
    (await link.click({
      clickCount: 2,
    }));
  const home_title = page.locator("h1");
  await expect(home_title).toHaveText("Chia1104");
});
