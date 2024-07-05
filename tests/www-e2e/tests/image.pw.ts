import { test, expect } from "@playwright/test";

test("test image", async ({ page }) => {
  const response = await page.request.get(
    "/_next/image?url=%2Fme%2Fme-memoji.PNG&w=640&q=75"
  );
  await expect(response).toBeOK();
});
