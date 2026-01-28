import { ViewTransition } from "react";

const Layout = ({ children }: LayoutProps<"/settings">) => {
  return (
    <ViewTransition>
      <div className="flex w-full flex-col">{children}</div>
    </ViewTransition>
  );
};

export default Layout;
