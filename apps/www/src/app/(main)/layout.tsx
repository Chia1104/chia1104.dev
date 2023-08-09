"use client";

import { Page, ScrollYProgress } from "ui";
import type { ReactNode } from "react";
import NavMenu from "./nav-menu";
import ReduxProvider from "./redux-provider";

const Layout = ({ children }: { children: ReactNode }) => {
  return (
    <ReduxProvider>
      <NavMenu />
      <ScrollYProgress className="fixed top-0 z-[999] mt-[75px]" />
      <Page>{children}</Page>
    </ReduxProvider>
  );
};

export default Layout;
