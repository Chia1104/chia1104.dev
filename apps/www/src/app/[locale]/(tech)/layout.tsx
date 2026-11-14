import type { ReactNode } from "react";

import { getLocale } from "next-intl/server";

import TechFrame from "@/components/commons/tech-frame";

const Layout = async ({ children }: { children: ReactNode }) => {
  const locale = await getLocale();
  return <TechFrame locale={locale}>{children}</TechFrame>;
};

export default Layout;
