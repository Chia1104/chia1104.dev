import type { ReactNode } from "react";
import { ViewTransition } from "react";

const Layout = ({ children }: { children: ReactNode }) => {
  return (
    <ViewTransition>
      <article className="page-container py-8">{children}</article>
    </ViewTransition>
  );
};

export default Layout;
