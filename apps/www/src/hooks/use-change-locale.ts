import type { Locale } from "next-intl";

import { useRouter, usePathname } from "@/libs/i18n/routing";

export const useChangeLocale = () => {
  const router = useRouter();
  const pathname = usePathname();
  const changeLocale = (locale: Locale) => {
    router.push(pathname, { locale });
    router.refresh();
  };
  return changeLocale;
};
