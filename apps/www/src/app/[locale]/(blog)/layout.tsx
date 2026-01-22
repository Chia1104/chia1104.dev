import { Suspense } from "react";

import { ErrorBoundary } from "@sentry/nextjs";
import { all } from "better-all";

import { NavigationMenu, NavigationMenuList } from "@chia/ui/navigation-menu";

import FeedNavigation from "@/components/blog/feed-navigation";
import { getPosts, getNotes } from "@/services/feeds.service";

export const revalidate = 300;

const Navigation = async () => {
  const { posts, notes } = await all({
    posts: () => getPosts(4),
    notes: () => getNotes(4),
  });

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
        <ErrorBoundary>
          <Suspense>
            <Navigation />
          </Suspense>
        </ErrorBoundary>
      </div>
      {children}
    </section>
  );
};

export default Layout;
