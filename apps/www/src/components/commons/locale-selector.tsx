"use client";

import type { Locale as TLocale } from "next-intl";
import { useTranslations } from "next-intl";

import type { ButtonProps } from "@heroui/react";
import { Button, Dropdown } from "@heroui/react";

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
      <Button size="sm" variant="tertiary" {...props}>
        {t("label")}
      </Button>
      <Dropdown.Popover>
        <Dropdown.Menu>
          {Object.values(Locale).map((locale) => (
            <Dropdown.Item key={locale} onPress={() => changeLocale(locale)}>
              {t(locale)}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
};

export default LocaleSelector;
