/**
 * Contact Page Object
 */
import type { Page } from "@playwright/test";

import { TEST_SELECTORS } from "../fixtures/test-data";

import { BasePage } from "./BasePage";

export class ContactPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async navigate() {
    await this.goto("/contact");
    await this.page.waitForLoadState("domcontentloaded");
  }

  // Getters
  get emailInput() {
    return this.page.locator(TEST_SELECTORS.CONTACT.EMAIL);
  }

  get titleInput() {
    return this.page.locator(TEST_SELECTORS.CONTACT.TITLE);
  }

  get messageInput() {
    return this.page.locator(TEST_SELECTORS.CONTACT.MESSAGE);
  }

  get submitButton() {
    return this.page.locator(TEST_SELECTORS.CONTACT.SUBMIT);
  }

  // Actions
  async fillContactForm(data: {
    email: string;
    title: string;
    message: string;
  }) {
    await this.emailInput.fill(data.email);
    await this.titleInput.fill(data.title);
    await this.messageInput.fill(data.message);
  }

  async submitForm() {
    await this.submitButton.click();
  }

  async verifyPageLoaded() {
    await this.emailInput.waitFor({ state: "visible" });
  }
}
