import type { Locale as _Locale } from "next-intl";

export const Locale = {
  EN: "en-US",
  ZH_TW: "zh-TW",
} as const;

export type Locale = (typeof Locale)[keyof typeof Locale];

/**
 * @deprecated
 * @param locale
 */
export const localeToTimeZone = (locale: _Locale) => {
  switch (locale) {
    case Locale.ZH_TW:
      return "Asia/Taipei";
    case Locale.EN:
      return "America/New_York";
  }
};
