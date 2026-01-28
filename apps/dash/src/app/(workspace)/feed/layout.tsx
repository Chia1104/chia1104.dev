import type { ReactNode } from "react";
import { ViewTransition } from "react";

const Layout = ({ children }: { children: ReactNode }) => {
  return (
    <ViewTransition>
      <article>{children}</article>
    </ViewTransition>
  );
};

export default Layout;
