import type { ReactNode } from "react";

import SearchFeed from "@/components/feed/search-feed";

const Layout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="w-full flex flex-col">
      <SearchFeed className="mb-10 max-w-fit" />
      {children}
    </div>
  );
};

export default Layout;
