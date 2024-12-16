"use client";

import { useEffect } from "react";

import { useLocale, useTimeZone } from "next-intl";

import { initDayjs } from "@/utils/dayjs";
import type { I18N } from "@/utils/i18n";

interface Props {
  enabled?: boolean;
}

export const InitDayjs = ({ enabled = true }: Props) => {
  const locale = useLocale() as I18N;
  const timeZone = useTimeZone();

  useEffect(() => {
    if (enabled) {
      initDayjs(locale, timeZone);
    }
  }, [enabled, locale, timeZone]);

  return null;
};
