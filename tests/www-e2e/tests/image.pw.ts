import { test, expect } from "@playwright/test";

test("test image", async ({ page }) => {
  const response = await page.request.get(
    "http://127.0.0.1:3002/_next/image?url=%2Fme%2Fme-memoji.PNG&w=640&q=75"
  );
  await expect(response).toBeOK();
});
