import { test as base } from "@playwright/test";

export const test = base.extend({
  // 自定義 fixtures 實作
});

export { expect } from "@playwright/test";
