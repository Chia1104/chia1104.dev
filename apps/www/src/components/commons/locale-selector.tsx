"use client";

import { useTransition } from "react";

import {
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@nextui-org/react";
import type { ButtonProps } from "@nextui-org/react";
import { useTranslations } from "next-intl";

import { setUserLocale } from "@/services/locale.service";
import { I18N } from "@/utils/i18n";

const DISABLED_I18N = true;

const LocaleSelector = (props: ButtonProps) => {
  const [isPending, setTransitioning] = useTransition();
  const t = useTranslations("locale");
  const changeLocale = (locale: I18N) => {
    setTransitioning(async () => {
      await setUserLocale(locale);
    });
  };
  return (
    <Dropdown className="not-prose" isDisabled={DISABLED_I18N || isPending}>
      <DropdownTrigger>
        <Button variant="flat" size="sm" loading={isPending} {...props}>
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
