import type { ReactNode } from "react";

const Layout = ({ children }: { children: ReactNode }) => {
  return <article>{children}</article>;
};

export default Layout;
