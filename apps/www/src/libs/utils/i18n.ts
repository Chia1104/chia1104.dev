import type { Locale as _Locale } from "next-intl";

import { Locale as DBLocale } from "@chia/db/types";

export const Locale = {
  En: "en-US",
  ZhTW: "zh-TW",
} as const;

export type Locale = (typeof Locale)[keyof typeof Locale];

export const dbLocaleResolver = (locale: string) => {
  switch (locale) {
    case Locale.ZhTW:
      return DBLocale.ZhTW;
    case Locale.En:
      return DBLocale.En;
    default:
      return DBLocale.ZhTW;
  }
};
