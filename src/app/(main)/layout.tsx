"use client";

import { Page } from "@chia/ui";
import { NavMenu, ReduxProvider } from "./components";
import type { ReactNode } from "react";

const Layout = ({ children }: { children: ReactNode }) => {
  return (
    <ReduxProvider>
      <NavMenu />
      <Page>{children}</Page>
    </ReduxProvider>
  );
};

export default Layout;
