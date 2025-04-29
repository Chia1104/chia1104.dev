"use client";

import { useMemo } from "react";

import type { ConfigType } from "dayjs";

import _dayjs from "@chia/utils/day";

interface Options {
  timezone?: string;
  locale?: string;
}

export function useDate(dayjs = _dayjs, options?: Options) {
  const { timezone: _timezone, locale } = options ?? {};

  const memoizedDateUtils = useMemo(() => {
    if (locale) {
      dayjs.locale(locale);
    }

    return {
      dayjs,
      formatDate: (date: ConfigType, format = "ll", timezone = _timezone) => {
        if (timezone) {
          return dayjs(date).tz(timezone).format(format);
        }

        return dayjs(date).format(format);
      },
      formatToISO: (date: ConfigType, timezone = _timezone) => {
        if (timezone) {
          return dayjs(date).tz(timezone).toISOString();
        }

        return dayjs(date).toISOString();
      },
    };
  }, [_timezone, locale, dayjs]);

  return memoizedDateUtils;
}
