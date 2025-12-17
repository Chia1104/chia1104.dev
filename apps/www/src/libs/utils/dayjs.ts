import type { Locale as TLocale } from "next-intl";

import dayjs from "@chia/utils/day";

import { env } from "@/env";
import { Locale } from "@/libs/utils/i18n";

export const initDayjs = (
  locale: TLocale = Locale.ZH_TW,
  timezone = env.NEXT_PUBLIC_DEFAULT_TIME_ZONE
) => {
  dayjs.tz.setDefault(timezone);
  dayjs.locale(locale);
};
