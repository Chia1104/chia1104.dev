import { test, expect } from "@playwright/test";

test("metadata favicon.ico", async ({ page }) => {
  const response = await page.request.get("/favicon.ico");
  await expect(response).toBeOK();
});

test("test home og image", async ({ page }) => {
  const response = await page.request.get("/opengraph-image");
  await expect(response).toBeOK();
});

// test("test sitemap", async ({ page }) => {
//   const response = await page.request.get(
//     "/sitemap-0.xml"
//   );
//   await expect(response).toBeOK();
// });

test("test robots.txt", async ({ page }) => {
  const response = await page.request.get("/robots.txt");
  await expect(response).toBeOK();
});
