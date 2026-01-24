import "server-only";

import type { ReactNode } from "react";

const Layout = ({ children }: { children: ReactNode }) => {
  return <article className="main container justify-start">{children}</article>;
};

export default Layout;
