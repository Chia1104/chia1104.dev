/**
 * Base Page Object - 所有頁面物件的基礎類別
 */
import type { Page, Locator } from "@playwright/test";

export class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(url: string) {
    await this.page.goto(url);
    // await this.waitForPageLoad();
  }

  async waitForPageLoad() {
    await this.page.waitForLoadState("domcontentloaded");
  }

  async getTitle() {
    return await this.page.title();
  }

  async waitForSelector(selector: string) {
    await this.page.waitForSelector(selector);
  }

  async click(selector: string) {
    await this.page.click(selector);
  }

  async fill(selector: string, value: string) {
    await this.page.fill(selector, value);
  }

  async getText(selector: string) {
    return await this.page.textContent(selector);
  }

  getLocator(selector: string): Locator {
    return this.page.locator(selector);
  }

  // 通用導航方法
  async clickNavLink(text: string) {
    await this.page.getByRole("link", { name: text }).click();
  }

  // 等待特定元素出現
  async waitForElement(selector: string, timeout = 5000) {
    await this.page.waitForSelector(selector, { timeout });
  }

  // 檢查元素是否可見
  async isVisible(selector: string): Promise<boolean> {
    return await this.page.locator(selector).isVisible();
  }

  // 截圖
  async takeScreenshot(name: string) {
    await this.page.screenshot({ path: `coverage/screenshots/${name}.png` });
  }
}
