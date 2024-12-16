import { useRouter, usePathname } from "@/i18n/routing";
import { I18N } from "@/utils/i18n";

export const useChangeLocale = () => {
  const router = useRouter();
  const pathname = usePathname();
  const changeLocale = (locale: I18N) => {
    router.push(pathname, { locale });
    router.refresh();
  };
  return changeLocale;
};
