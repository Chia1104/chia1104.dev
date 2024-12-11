import type { ReactNode } from "react";

import "server-only";

const Layout = ({ children }: { children: ReactNode }) => {
  return (
    <article className="c-container main justify-start">{children}</article>
  );
};

export default Layout;
