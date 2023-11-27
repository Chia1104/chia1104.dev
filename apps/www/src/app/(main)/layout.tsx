"use client";

import { Page, ScrollYProgress } from "@chia/ui";
import type { ReactNode } from "react";
import NavMenu from "./_components/nav-menu";
import ReduxProvider from "./_components/redux-provider";

const Layout = ({ children }: { children: ReactNode }) => {
  return (
    <ReduxProvider>
      <NavMenu />
      <ScrollYProgress className="fixed top-0 z-[999]" />
      <Page>{children}</Page>
    </ReduxProvider>
  );
};

export default Layout;
