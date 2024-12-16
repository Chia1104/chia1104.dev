import type { ReactNode } from "react";

import { getTimeZone } from "next-intl/server";

import { initDayjs } from "@/utils/dayjs";
import { PageParamsWithLocale } from "@/utils/i18n";

const Template = async ({
  children,
  params,
}: {
  children: ReactNode;
  params: PageParamsWithLocale;
}) => {
  const { locale } = await params;
  const timeZone = await getTimeZone();
  initDayjs(locale, timeZone);
  return children;
};

export default Template;
