import { Page } from "@chia/components/client";
import type { ReactNode } from "react";

const Layout = ({ children }: { children: ReactNode }) => {
  return <Page>{children}</Page>;
};

export default Layout;
