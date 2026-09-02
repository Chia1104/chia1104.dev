import type { ReactNode } from "react";
import { ViewTransition } from "react";

const Layout = ({ children }: { children: ReactNode }) => {
  return (
    <ViewTransition>
      <article className="flex w-full justify-center">
        <div className="w-full max-w-6xl px-4 py-8 md:px-6 lg:px-8">
          {children}
        </div>
      </article>
    </ViewTransition>
  );
};

export default Layout;
