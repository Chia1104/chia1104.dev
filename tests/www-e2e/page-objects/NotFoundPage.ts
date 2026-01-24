/**
 * 404 Not Found Page Object
 */
import type { Page } from "@playwright/test";

import { TEST_SELECTORS } from "../fixtures/test-data";

import { BasePage } from "./BasePage";

export class NotFoundPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // Getters
  get title() {
    return this.page.locator(TEST_SELECTORS.NOT_FOUND.TITLE);
  }

  get backLink() {
    return this.page.getByText("cd ../");
  }

  // Actions
  async verifyPageLoaded() {
    await this.title.waitFor({ state: "visible" });
  }

  async getTitleText() {
    return await this.title.textContent();
  }

  async clickBackLink() {
    await this.backLink.click();
  }

  async navigateToInvalidPage(url: string) {
    await this.goto(url);
  }
}
