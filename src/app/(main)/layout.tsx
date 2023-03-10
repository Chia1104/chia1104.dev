import { ActionIcon, Page } from "@chia/ui";
import { JotaiProvider } from "@chia/ui/Provider";
import { NavMenu } from "./components";
import type { ReactNode } from "react";

const Layout = ({ children }: { children: ReactNode }) => {
  return (
    <JotaiProvider>
      <NavMenu />
      <ActionIcon />
      <Page>{children}</Page>
    </JotaiProvider>
  );
};

export default Layout;
