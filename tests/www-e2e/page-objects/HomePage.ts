/**
 * Home Page Object
 */
import type { Page } from "@playwright/test";

import { TEST_URLS, TEST_SELECTORS } from "../fixtures/test-data";

import { BasePage } from "./BasePage";

export class HomePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async navigate() {
    await this.goto(TEST_URLS.HOME);
  }

  // Getters
  get nameTitle() {
    return this.page.locator(TEST_SELECTORS.HOME.NAME);
  }

  get navigationMenu() {
    return this.page.locator(TEST_SELECTORS.NAVIGATION.MENU);
  }

  get footer() {
    return this.page.locator(TEST_SELECTORS.FOOTER.CONTAINER);
  }

  get mainContent() {
    return this.page.locator(TEST_SELECTORS.MAIN.CONTENT);
  }

  get postsLink() {
    return this.page.locator(TEST_SELECTORS.NAVIGATION.POSTS_LINK);
  }

  get projectsLink() {
    return this.page.locator(TEST_SELECTORS.NAVIGATION.PROJECTS_LINK);
  }

  // Actions
  async verifyPageLoaded() {
    await this.nameTitle.waitFor({ state: "visible" });
  }

  async getNameText() {
    return await this.nameTitle.textContent();
  }

  async clickPostsLink() {
    await this.postsLink.click();
  }

  async clickProjectsLink() {
    await this.projectsLink.click();
  }

  async clickContactLink() {
    await this.page
      .getByRole("link", { name: /contact/i })
      .first()
      .click();
  }

  // Assertions helpers
  async verifyNameIs(expectedName: string) {
    const name = await this.getNameText();
    return name === expectedName;
  }
}
