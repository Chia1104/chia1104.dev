import { test, expect } from "@playwright/test";

test("home page", async ({ page }) => {
  await page.goto("http://127.0.0.1:3002/");
  const title = page.locator("h1");
  await expect(title).toHaveText("Chia1104 俞又嘉");
  const img = page.getByAltText("Chia1104");
  await expect(img).toBeVisible();
});
