"use client";

import { Page } from "ui";
import type { ReactNode } from "react";
import NavMenu from "./nav-menu";
import ReduxProvider from "./redux-provider";

const Layout = ({ children }: { children: ReactNode }) => {
  return (
    <ReduxProvider>
      <NavMenu />
      <Page>{children}</Page>
    </ReduxProvider>
  );
};

export default Layout;
