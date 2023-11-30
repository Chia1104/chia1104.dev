import { NavigationMenu, NavigationMenuList, cn } from "@chia/ui";
import { type FC, type ReactNode } from "react";
import { getPosts, getNotes } from "@/helpers/services/feeds.service";
import { type RouterOutputs } from "@chia/api";
import { PostNavigation } from "./_components/posts";
import { NoteNavigation } from "./_components/notes";

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
    <article className="main c-container prose dark:prose-invert mt-20 max-w-[700px] items-start">
      <div className="z-30">
        <Navigation posts={posts.items} notes={notes.items} />
      </div>
      {children}
    </article>
  );
};

export default Layout;
