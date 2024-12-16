import type { FC, ReactNode } from "react";

import type { RouterOutputs } from "@chia/api";
import { NavigationMenu, NavigationMenuList } from "@chia/ui/navigation-menu";

import { NoteNavigation } from "@/components/blog/notes";
import { PostNavigation } from "@/components/blog/posts";
import { getPosts, getNotes } from "@/services/feeds.service";
import type { PageParamsWithLocale, I18N } from "@/utils/i18n";

const Navigation: FC<{
  posts?: RouterOutputs["feeds"]["getFeedsWithMetaByAdminId"]["items"];
  notes?: RouterOutputs["feeds"]["getFeedsWithMetaByAdminId"]["items"];
  locale?: I18N;
}> = ({ posts, notes, locale }) => {
  return (
    <NavigationMenu className="not-prose mb-5 md:mb-10">
      <NavigationMenuList className="gap-5">
        <PostNavigation posts={posts} locale={locale} />
        <NoteNavigation notes={notes} locale={locale} />
      </NavigationMenuList>
    </NavigationMenu>
  );
};

const Layout: FC<{
  children: ReactNode;
  params: PageParamsWithLocale;
}> = async ({ children, params }) => {
  const { locale } = await params;
  const [posts, notes] = await Promise.all([getPosts(4), getNotes(4)]);
  return (
    <article className="main c-container prose dark:prose-invert mt-10 md:mt-20 w-full items-start justify-start">
      <div className="z-30">
        <Navigation posts={posts.items} notes={notes.items} locale={locale} />
      </div>
      {children}
    </article>
  );
};

export default Layout;
