import type { Locale } from "next-intl";

import { usePathname, useRouter } from "@/libs/i18n/navigation";

export const useChangeLocale = () => {
  const router = useRouter();
  const pathname = usePathname();
  const changeLocale = (locale: Locale) => {
    router.push(pathname, { locale });
    router.refresh();
  };
  return changeLocale;
};
