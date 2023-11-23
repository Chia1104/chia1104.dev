import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuIndicator,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuViewport,
} from "@chia/ui";
import { type FC, type ReactNode } from "react";
import ListItem from "./_components/list-item";
import { getPosts, getNotes } from "@/helpers/services/feeds.service";
import { type RouterOutputs } from "@chia/api";

const Navigation: FC<{
  posts?: RouterOutputs["feeds"]["infinityByAdmin"]["items"];
  notes?: RouterOutputs["feeds"]["infinityByAdmin"]["items"];
}> = ({ posts, notes }) => {
  return (
    <NavigationMenu className="not-prose">
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Posts</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid gap-3 p-6 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr]">
              {!!posts && Array.isArray(posts) && posts.length > 0 ? (
                posts?.map((post, index) => {
                  if (index === 0) {
                    return (
                      <li key={post.id} className="row-span-3">
                        <NavigationMenuLink asChild>
                          <a
                            className="from-muted/50 to-muted flex h-full w-full select-none flex-col justify-end rounded-md bg-gradient-to-b p-6 no-underline outline-none focus:shadow-md"
                            href={`/posts/${post.slug}`}>
                            <div className="mb-2 mt-4 line-clamp-2 text-lg font-medium">
                              {post.title}
                            </div>
                            <p className="text-muted-foreground line-clamp-3 text-sm leading-tight">
                              {post.description}
                            </p>
                          </a>
                        </NavigationMenuLink>
                      </li>
                    );
                  }
                  return (
                    <ListItem
                      key={post.id}
                      title={post.title}
                      href={`/posts/${post.slug}`}>
                      {post.description}
                    </ListItem>
                  );
                })
              ) : (
                <ListItem>No posts found.</ListItem>
              )}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Notes</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px] ">
              {!!notes && Array.isArray(notes) && notes.length > 0 ? (
                notes?.map((note) => (
                  <ListItem
                    key={note.id}
                    title={note.title}
                    href={`/notes/${note.slug}`}>
                    {note.description}
                  </ListItem>
                ))
              ) : (
                <ListItem>No notes found.</ListItem>
              )}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
};

const Layout: FC<{ children: ReactNode }> = async ({ children }) => {
  const [posts, notes] = await Promise.all([getPosts(4), getNotes(4)]);
  return (
    <article className="main c-container prose dark:prose-invert mt-20">
      <div>
        <Navigation posts={posts.items} notes={notes.items} />
      </div>
      {children}
    </article>
  );
};

export default Layout;
