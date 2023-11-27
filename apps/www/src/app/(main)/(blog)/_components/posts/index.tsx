"use client";

import {
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuTrigger,
  cn,
} from "@chia/ui";
import { type FC } from "react";
import { type RouterOutputs } from "@chia/api";
import ListItem from "../list-item";
import { useRouter } from "next/navigation";
import Link from "next/link";

export const PostNavigation: FC<{
  posts?: RouterOutputs["feeds"]["infinityByAdmin"]["items"];
}> = ({ posts }) => {
  const hasPosts = !!posts && Array.isArray(posts) && posts.length > 0;
  const router = useRouter();
  return (
    <NavigationMenuItem>
      <NavigationMenuTrigger onClick={() => router.push("/posts")}>
        Posts
      </NavigationMenuTrigger>
      <NavigationMenuContent>
        <ul
          className={cn(
            "grid w-[300px] gap-3 p-4 pb-0 md:w-[500px] lg:w-[600px]",
            hasPosts ? "lg:grid-cols-[.75fr_1fr]" : "max-w-[300px]"
          )}>
          {hasPosts ? (
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
            <ListItem className="row-span-6">No posts found.</ListItem>
          )}
        </ul>
        <span className="flex w-full items-center justify-end gap-1 py-2 pb-5 pr-5 text-sm font-medium">
          <Link href="/posts" className="w-fit">
            View all posts
          </Link>
          <span className="i-lucide-chevron-right h-3 w-3" />
        </span>
      </NavigationMenuContent>
    </NavigationMenuItem>
  );
};
