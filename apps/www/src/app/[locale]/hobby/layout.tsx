import type { ReactNode } from "react";

import { getLocale } from "next-intl/server";

import HobbyFrame from "@/components/hobby/hobby-frame";

const Layout = async ({ children }: { children: ReactNode }) => {
  const locale = await getLocale();
  return <HobbyFrame locale={locale}>{children}</HobbyFrame>;
};

export default Layout;
