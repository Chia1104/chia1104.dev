import type { ReactNode } from "react";

const Layout = ({ children }: { children: ReactNode }) => {
  return <div className="w-full flex flex-col">{children}</div>;
};

export default Layout;
