import dayjs from "@chia/utils/day";

import { env } from "@/env";
import { I18N } from "@/utils/i18n";

export const initDayjs = (
  locale: I18N = I18N.ZH_TW,
  timezone = env.NEXT_PUBLIC_DEFAULT_TIME_ZONE
) => {
  dayjs.tz.setDefault(timezone);
  dayjs.locale(locale);
};
