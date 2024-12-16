export const I18N = {
  EN: "en",
  ZH_TW: "zh-tw",
} as const;

export type I18N = (typeof I18N)[keyof typeof I18N];

export type PropsWithLocale<T = unknown> = T & { locale?: I18N };

export type PageParamsWithLocale<T = unknown> = Promise<T & { locale: I18N }>;

/**
 * @deprecated
 * @param locale
 */
export const localeToTimeZone = (locale: I18N) => {
  switch (locale) {
    case I18N.ZH_TW:
      return "Asia/Taipei";
    case I18N.EN:
      return "America/New_York";
  }
};
