import { Suspense } from "react";

import { cacheLife } from "next/cache";

import { NavigationMenu, NavigationMenuList } from "@chia/ui/navigation-menu";

import FeedNavigation from "@/components/blog/feed-navigation";
import { getPosts, getNotes } from "@/services/feeds.service";

const Navigation = async () => {
  "use cache";
  cacheLife({
    revalidate: 120,
  });

  const [posts, notes] = await Promise.all([getPosts(4), getNotes(4)]);

  return (
    <NavigationMenu className="not-prose mb-5 md:mb-10 z-20">
      <NavigationMenuList className="gap-5">
        <FeedNavigation feeds={posts.items} type="post" />
        <FeedNavigation feeds={notes.items} type="note" />
      </NavigationMenuList>
    </NavigationMenu>
  );
};

const Layout = ({ children }: LayoutProps<"/[locale]">) => {
  return (
    <section className="prose dark:prose-invert mt-10 md:mt-20 w-full items-start justify-start min-w-full min-h-[calc(100vh-140px)] flex flex-col">
      <div className="z-30">
        <Suspense>
          <Navigation />
        </Suspense>
      </div>
      {children}
    </section>
  );
};

export default Layout;
