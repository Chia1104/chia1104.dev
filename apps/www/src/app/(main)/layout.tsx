import { Page, ScrollYProgress } from "@chia/ui";
import type { ReactNode } from "react";
import NavMenu from "./_components/nav-menu";

const Layout = ({ children }: { children: ReactNode }) => {
  return (
    <>
      <NavMenu />
      <ScrollYProgress className="fixed top-0 z-[999]" />
      <Page>{children}</Page>
    </>
  );
};

export default Layout;
