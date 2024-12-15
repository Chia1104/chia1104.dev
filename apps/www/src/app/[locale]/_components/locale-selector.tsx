"use client";

import {
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@nextui-org/react";
import type { ButtonProps } from "@nextui-org/react";
import { useTranslations } from "next-intl";

import { useRouter, usePathname } from "@/i18n/routing";
import { I18N } from "@/utils/i18n";

const LocaleSelector = (props: ButtonProps) => {
  const t = useTranslations("locale");
  const router = useRouter();
  const pathname = usePathname();
  const changeLocale = (locale: I18N) => {
    router.push(pathname, { locale });
  };
  return (
    <Dropdown className="not-prose">
      <DropdownTrigger>
        <Button variant="flat" size="sm" {...props}>
          {t("label")}
        </Button>
      </DropdownTrigger>
      <DropdownMenu>
        {Object.values(I18N).map((locale) => (
          <DropdownItem key={locale} onPress={() => changeLocale(locale)}>
            {t(locale)}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
};

export default LocaleSelector;
