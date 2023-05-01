import { test, expect } from "@playwright/test";

test("home page", async ({ page }) => {
  await page.goto("http://localhost:3000/");
  const title = page.locator("h1");
  await expect(title).toHaveText("Chia1104 俞又嘉");
});
