/**
 * 測試資料管理
 */

export const TEST_URLS = {
  HOME: "/",
  NOT_FOUND: "/this-is-not-found-page",
  POSTS: "/posts",
  NOTES: "/notes",
  PROJECTS: "/projects",
  CONTACT: "/contact",
} as const;

export const TEST_SELECTORS = {
  HOME: {
    NAME: "[data-testid='about-me-name']",
    HERO_SECTION: "[data-testid='hero-section']",
  },
  NAVIGATION: {
    MENU: "[data-testid='nav-menu']",
    MENU_ITEMS: "[data-testid='nav-menu'] a",
    POSTS_LINK: "[data-testid='nav-link-posts']",
    PROJECTS_LINK: "[data-testid='nav-link-projects']",
  },
  MAIN: {
    CONTENT: "[data-testid='main-content']",
  },
  FOOTER: {
    CONTAINER: "[data-testid='footer']",
    COPYRIGHT: "footer",
    CURRENT_PLAYING: "[data-testid='current-playing']",
    HUGE_THANKS: "[data-testid='huge-thanks']",
    LOCALE_SELECTOR: "[data-testid='locale-selector']",
  },
  CONTACT: {
    EMAIL: "[data-testid='contact-email']",
    TITLE: "[data-testid='contact-title']",
    MESSAGE: "[data-testid='contact-message']",
    SUBMIT: "[data-testid='contact-submit']",
  },
  NOT_FOUND: {
    TITLE: "[data-testid='main-content'] h1",
    BACK_LINK: "[data-testid='main-content'] a[href='/']",
  },
} as const;

/** 未帶語系前綴的網址使用預設語系 zh-TW。 */
export const TEST_COPY = {
  NOT_FOUND_TITLE: "找不到這個頁面",
  NOT_FOUND_TITLE_EN: "This page doesn't exist",
} as const;

export const TEST_METADATA = {
  SITE_NAME: "Chia1104",
  DEFAULT_TITLE: "Chia1104",
} as const;

export const VIEWPORT_SIZES = {
  MOBILE: { width: 375, height: 667 },
  TABLET: { width: 768, height: 1024 },
  DESKTOP: { width: 1920, height: 1080 },
} as const;
