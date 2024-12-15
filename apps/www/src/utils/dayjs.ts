import dayjs from "@chia/utils/day";

import { I18N } from "@/utils/i18n";

export const initDayjs = (
  locale: I18N = I18N.ZH_TW,
  timezone = "Asia/Taipei"
) => {
  dayjs.tz.setDefault(timezone);
  dayjs.locale(locale);
};
