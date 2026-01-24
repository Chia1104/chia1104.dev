import { getTimeZone, getLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { initDayjs } from "@/libs/utils/dayjs";

const Template = async ({ children }: { children: ReactNode }) => {
  const locale = await getLocale();
  const timeZone = await getTimeZone();
  initDayjs(locale, timeZone);
  return <>{children}</>;
};

export default Template;
