import type { ReactNode } from "react";

import FeedTabs from "@/components/feed/feed-tabs";
import SearchFeed from "@/components/feed/search-feed";

const Layout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex w-full flex-col">
      <section className="flex min-h-screen w-full justify-center">
        <div className="w-full px-4 py-8 md:px-6 lg:px-8">
          <div className="mb-6 flex flex-col items-start gap-4">
            <FeedTabs className="w-fit" />
            <SearchFeed className="max-w-fit" />
          </div>
          {children}
        </div>
      </section>
    </div>
  );
};

export default Layout;
