"use client";

import type { Locale as TLocale } from "next-intl";
import { useTranslations } from "next-intl";

import type { ButtonProps } from "@heroui/react";
import {
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/react";

import { useRouter, usePathname } from "@/libs/i18n/routing";
import { Locale } from "@/libs/utils/i18n";

const LocaleSelector = (props: ButtonProps) => {
  const t = useTranslations("locale");
  const router = useRouter();
  const pathname = usePathname();
  const changeLocale = (locale: TLocale) => {
    router.push(pathname, { locale });
    router.refresh();
  };
  return (
    <Dropdown className="not-prose" data-testid="locale-selector">
      <DropdownTrigger>
        <Button variant="flat" size="sm" {...props}>
          {t("label")}
        </Button>
      </DropdownTrigger>
      <DropdownMenu>
        {Object.values(Locale).map((locale) => (
          <DropdownItem key={locale} onPress={() => changeLocale(locale)}>
            {t(locale)}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
};

export default LocaleSelector;
