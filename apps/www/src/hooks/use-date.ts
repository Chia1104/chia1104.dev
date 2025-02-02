import { useMemo } from "react";

import { useLocale, useTimeZone } from "next-intl";

import dayjs from "@chia/utils/day";

export function useDate() {
  const locale = useLocale();
  const _timezone = useTimeZone();

  const memoizedDateUtils = useMemo(() => {
    dayjs.locale(locale);

    return {
      dayjs,
      formatDate: (
        date: dayjs.ConfigType,
        format = "ll",
        timezone = _timezone
      ) => {
        return dayjs(date).tz(timezone).format(format);
      },
      formatToISO: (date: dayjs.ConfigType) => {
        return dayjs(date).toISOString();
      },
    };
  }, [_timezone, locale]);

  return memoizedDateUtils;
}
