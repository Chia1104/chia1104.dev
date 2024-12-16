import type { FC, ReactNode } from "react";

import type { RouterOutputs } from "@chia/api";
import { NavigationMenu, NavigationMenuList } from "@chia/ui/navigation-menu";

import FeedNavigation from "@/components/blog/feed-navigation";
import { getPosts, getNotes } from "@/services/feeds.service";
import type { PageParamsWithLocale } from "@/utils/i18n";

const Navigation: FC<{
  posts?: RouterOutputs["feeds"]["getFeedsWithMetaByAdminId"]["items"];
  notes?: RouterOutputs["feeds"]["getFeedsWithMetaByAdminId"]["items"];
}> = ({ posts, notes }) => {
  return (
    <NavigationMenu className="not-prose mb-5 md:mb-10">
      <NavigationMenuList className="gap-5">
        <FeedNavigation feeds={posts} type="post" />
        <FeedNavigation feeds={notes} type="note" />
      </NavigationMenuList>
    </NavigationMenu>
  );
};

const Layout: FC<{
  children: ReactNode;
  params: PageParamsWithLocale;
}> = async ({ children }) => {
  const [posts, notes] = await Promise.all([getPosts(4), getNotes(4)]);
  return (
    <article className="main c-container prose dark:prose-invert mt-10 md:mt-20 w-full items-start justify-start">
      <div className="z-30">
        <Navigation posts={posts.items} notes={notes.items} />
      </div>
      {children}
    </article>
  );
};

export default Layout;
