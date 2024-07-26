import type { FC, ReactNode } from "react";

import type { RouterOutputs } from "@chia/api";
import { NavigationMenu, NavigationMenuList } from "@chia/ui";

import { getPosts, getNotes } from "@/services/feeds.service";

import { NoteNavigation } from "./_components/notes";
import { PostNavigation } from "./_components/posts";

const Navigation: FC<{
  posts?: RouterOutputs["feeds"]["infinityByAdmin"]["items"];
  notes?: RouterOutputs["feeds"]["infinityByAdmin"]["items"];
}> = ({ posts, notes }) => {
  return (
    <NavigationMenu className="not-prose mb-10">
      <NavigationMenuList className="gap-5">
        <PostNavigation posts={posts} />
        <NoteNavigation notes={notes} />
      </NavigationMenuList>
    </NavigationMenu>
  );
};

const Layout: FC<{ children: ReactNode }> = async ({ children }) => {
  const [posts, notes] = await Promise.all([getPosts(4), getNotes(4)]);
  return (
    <article className="main c-container prose dark:prose-invert mt-20 w-full items-start justify-start">
      <div className="z-30">
        <Navigation posts={posts.items} notes={notes.items} />
      </div>
      {children}
    </article>
  );
};

export default Layout;
