import { test, expect } from "@playwright/test";

test("metadata favicon.ico", async ({ page }) => {
  const response = await page.request.get("http://127.0.0.1:3002/favicon.ico");
  await expect(response).toBeOK();
});
