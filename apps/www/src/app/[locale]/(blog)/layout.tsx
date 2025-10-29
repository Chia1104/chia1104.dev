import { Suspense } from "react";

import { cacheTag, cacheLife } from "next/cache";

import { NavigationMenu, NavigationMenuList } from "@chia/ui/navigation-menu";

import FeedNavigation from "@/components/blog/feed-navigation";
import { getPosts, getNotes, FEEDS_CACHE_TAGS } from "@/services/feeds.service";

const getPostsWithCache = async () => {
  "use cache: remote";
  cacheTag(...FEEDS_CACHE_TAGS.getPosts(4));
  cacheLife({
    revalidate: 120,
  });

  return getPosts(4);
};

const getNotesWithCache = async () => {
  "use cache: remote";
  cacheTag(...FEEDS_CACHE_TAGS.getNotes(4));
  cacheLife({
    revalidate: 120,
  });

  return getNotes(4);
};

const Navigation = async () => {
  const [posts, notes] = await Promise.all([
    getPostsWithCache(),
    getNotesWithCache(),
  ]);
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
