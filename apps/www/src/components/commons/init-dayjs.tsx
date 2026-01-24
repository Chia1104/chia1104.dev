"use client";

import { useLocale, useTimeZone } from "next-intl";
import { useEffect } from "react";

import { initDayjs } from "@/libs/utils/dayjs";

interface Props {
  enabled?: boolean;
}

export const InitDayjs = ({ enabled = true }: Props) => {
  const locale = useLocale();
  const timeZone = useTimeZone();

  useEffect(() => {
    if (enabled) {
      initDayjs(locale, timeZone);
    }
  }, [enabled, locale, timeZone]);

  return null;
};
