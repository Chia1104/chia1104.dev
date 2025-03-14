type PropsWithLocale<T = unknown> = T & { locale?: import("next-intl").Locale };

type PageParamsWithLocale<T = unknown> = Promise<
  T & { locale: import("next-intl").Locale }
>;
