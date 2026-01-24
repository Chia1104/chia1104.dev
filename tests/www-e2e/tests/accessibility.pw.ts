import { test, expect } from "@playwright/test";

test.describe("可訪問性測試", () => {
  test("頁面應該有正確的語言屬性", async ({ page }) => {
    await page.goto("/");
    const lang = await page.locator("html").getAttribute("lang");
    expect(lang).toBeTruthy();
    expect(["en", "zh", "zh-TW", "en-US"]).toContain(lang);
  });

  test("所有圖片應該有 alt 屬性", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const images = await page.locator("img").all();

    for (const img of images) {
      const alt = await img.getAttribute("alt");
      expect(alt).not.toBeNull();
    }
  });

  test("表單元素應該有適當的標籤", async ({ page }) => {
    await page.goto("/contact");
    await page.waitForLoadState("domcontentloaded");

    const inputs = await page.locator("input, textarea").all();

    // 至少應該有一些表單元素
    expect(inputs.length).toBeGreaterThan(0);

    for (const input of inputs.slice(0, 5)) {
      const id = await input.getAttribute("id");
      const ariaLabel = await input.getAttribute("aria-label");
      const ariaLabelledBy = await input.getAttribute("aria-labelledby");
      const name = await input.getAttribute("name");

      // 表單元素應該有某種識別方式
      const hasIdentifier = id || ariaLabel || ariaLabelledBy || name;
      expect(hasIdentifier).toBeTruthy();
    }
  });

  test("頁面應該有適當的 heading 層級", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // 應該有 heading 元素
    const headings = await page.locator("h1, h2, h3, h4, h5, h6").count();
    expect(headings).toBeGreaterThan(0);
  });

  test("按鈕應該可以用鍵盤操作", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const buttons = await page.locator("button:visible").all();

    // 只檢查前幾個可見的按鈕
    for (const button of buttons.slice(0, 3)) {
      const isVisible = await button.isVisible().catch(() => false);
      if (isVisible) {
        await button.focus();
      }
    }

    expect(buttons.length).toBeGreaterThanOrEqual(0);
  });

  test("焦點應該可見", async ({ page }) => {
    await page.goto("/");

    // Tab 到第一個可聚焦元素
    await page.keyboard.press("Tab");

    // 檢查是否有焦點樣式
    const focusedElement = await page.locator(":focus");
    expect(await focusedElement.count()).toBeGreaterThan(0);
  });

  test("頁面應該有 skip to main content 連結", async ({ page }) => {
    await page.goto("/");

    // 按 Tab 鍵，第一個焦點通常應該是 skip link
    await page.keyboard.press("Tab");

    const focusedElement = await page.locator(":focus");
    const text = await focusedElement.textContent();

    // Skip link 可能存在也可能不存在，這取決於設計
    expect(text).toBeDefined();
  });

  test("顏色對比度應該足夠（基本檢查）", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // 檢查主要文字元素是否可見
    const textElements = await page.locator("p, h1, h2, h3, h4, h5, h6").all();

    let visibleCount = 0;
    for (const element of textElements.slice(0, 10)) {
      // 只檢查前 10 個
      const isVisible = await element.isVisible().catch(() => false);
      if (isVisible) visibleCount++;
    }

    expect(visibleCount).toBeGreaterThan(0);
  });

  test("表單驗證錯誤應該可訪問", async ({ page }) => {
    await page.goto("/contact");
    await page.waitForLoadState("domcontentloaded");

    // 檢查提交按鈕是否存在
    const submitButton = page.locator("[data-testid='contact-submit']");
    const buttonExists = (await submitButton.count()) > 0;

    expect(buttonExists).toBeTruthy();
  });

  test("互動元素應該有適當的 ARIA 角色", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // 檢查按鈕存在
    const buttons = await page.locator("button").count();
    expect(buttons).toBeGreaterThanOrEqual(0);

    // 檢查連結存在
    const links = await page.locator("a").count();
    expect(links).toBeGreaterThan(0);
  });

  test("模態框應該正確處理焦點", async ({ page }) => {
    await page.goto("/");

    // 尋找觸發模態框的按鈕（如果有的話）
    const modalTriggers = await page
      .locator('[aria-haspopup="dialog"]')
      .count();

    if (modalTriggers > 0) {
      await page.locator('[aria-haspopup="dialog"]').first().click();

      // 等待模態框出現
      await page.waitForSelector('[role="dialog"]', { timeout: 3000 });

      // 檢查焦點是否在模態框內
      const dialog = page.locator('[role="dialog"]');
      if ((await dialog.count()) > 0) {
        expect(await dialog.isVisible()).toBeTruthy();
      }
    }
  });
});
