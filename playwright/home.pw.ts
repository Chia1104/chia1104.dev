import { test, expect } from "@playwright/test";

test("should display the home page", async ({ page }) => {
  await page.goto("/");
  const title = await page.textContent("h1");
  expect(title).toBe("Chia1104 俞又嘉");
});
