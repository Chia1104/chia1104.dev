import type { ReactNode } from "react";

import { getTimeZone, getLocale } from "next-intl/server";

import { initDayjs } from "@/utils/dayjs";
import type { I18N } from "@/utils/i18n";

const Template = async ({ children }: { children: ReactNode }) => {
  const locale = (await getLocale()) as I18N;
  const timeZone = await getTimeZone();
  initDayjs(locale, timeZone);
  return <>{children}</>;
};

export default Template;
