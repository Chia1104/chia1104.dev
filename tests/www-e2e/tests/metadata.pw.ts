import { test, expect } from "@playwright/test";

test("metadata favicon.ico", async ({ page }) => {
  const response = await page.request.get("http://127.0.0.1:3002/favicon.ico");
  await expect(response).toBeOK();
});

test("test home og image", async ({ page }) => {
  const response = await page.request.get(
    "http://127.0.0.1:3002/opengraph-image"
  );
  await expect(response).toBeOK();
});

// test("test sitemap", async ({ page }) => {
//   const response = await page.request.get(
//     "http://127.0.0.1:3002/sitemap-0.xml"
//   );
//   await expect(response).toBeOK();
// });

test("test robots.txt", async ({ page }) => {
  const response = await page.request.get("http://127.0.0.1:3002/robots.txt");
  await expect(response).toBeOK();
});
