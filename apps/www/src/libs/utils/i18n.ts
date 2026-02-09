import type { Locale as _Locale } from "next-intl";

import { Locale as DBLocale } from "@chia/db/types";

export const Locale = {
  EN: "en-US",
  ZH_TW: "zh-TW",
} as const;

export type Locale = (typeof Locale)[keyof typeof Locale];

export const dbLocaleResolver = (locale: string) => {
  switch (locale) {
    case Locale.ZH_TW:
      return DBLocale.zhTW;
    case Locale.EN:
      return DBLocale.En;
    default:
      return DBLocale.zhTW;
  }
};
