import { ActionIcon, Page } from "@chia/ui";
import { NavMenu, ReduxProvider } from "./components";
import type { ReactNode } from "react";

const Layout = ({ children }: { children: ReactNode }) => {
  return (
    <ReduxProvider>
      <NavMenu />
      <ActionIcon />
      <Page>{children}</Page>
    </ReduxProvider>
  );
};

export default Layout;
