import { test, expect } from "@playwright/test";

test("not-found page", async ({ page }) => {
  await page.goto("http://127.0.0.1:3002/this-is-not-found-page");
  const title = page.locator("h2");
  await expect(title).toHaveText("404");
  const link = page.locator("a");
  await expect(link).toHaveText("Go back");
  await expect(link).toHaveAttribute("href", "/");
  await link.click();
  await expect(page.url()).toBe("http://127.0.0.1:3002/");
  const home_title = page.locator("h1");
  await expect(home_title).toHaveText("Chia1104 俞又嘉");
});
