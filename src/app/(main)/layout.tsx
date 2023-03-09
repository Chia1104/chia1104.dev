import { ActionIcon, Page } from "@chia/ui";
import { NavMenu } from "./components";
import type { ReactNode } from "react";
import { ReduxProvider } from "@chia/app/components/Provider/RootProvider";

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
