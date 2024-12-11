import type { ReactNode } from "react";

import "server-only";

const Layout = ({ children }: { children: ReactNode }) => {
  return (
    <article className="c-container main justify-start items-start">
      <h2 className="mb-10 text-4xl text-start">Settings</h2>
      {children}
    </article>
  );
};

export default Layout;
