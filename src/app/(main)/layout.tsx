import { ActionIcon, Page } from "@chia/ui";
import { NavMenu } from "./components";
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
