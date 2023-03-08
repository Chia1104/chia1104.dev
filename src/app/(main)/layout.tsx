import { ActionIcon, NavMenu, Page } from "@chia/components/client";
import type { ReactNode } from "react";

const Layout = ({ children }: { children: ReactNode }) => {
  return (
    <>
      <NavMenu />
      <ActionIcon />
      <Page>{children}</Page>
    </>
  );
};

export default Layout;
