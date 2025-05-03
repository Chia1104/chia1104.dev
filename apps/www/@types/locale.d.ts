type Locale = import("next-intl").Locale;

type PropsWithLocale<T = unknown> = T & { locale: Locale };

type PageParamsWithLocale<T = unknown> = Promise<PropsWithLocale<T>>;

interface PagePropsWithLocale<
  TParams = unknown,
  TSearchParams extends PageSearchParams = PageSearchParams,
> {
  params: PageParamsWithLocale<TParams>;
  children: React.ReactNode;
}
