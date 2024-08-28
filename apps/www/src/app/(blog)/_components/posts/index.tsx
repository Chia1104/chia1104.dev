"use client";

import { useMemo } from "react";
import type { FC } from "react";

import dayjs from "dayjs";
import { useRouter } from "next/navigation";

import type { RouterOutputs, RouterInputs } from "@chia/api";
import {
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuTrigger,
  cn,
  Timeline,
  Link,
} from "@chia/ui";
import type { TimelineTypes } from "@chia/ui";

import { api } from "@/trpc/client";

import ListItem from "../list-item";

export const PostNavigation: FC<{
  posts?: RouterOutputs["feeds"]["getFeedsWithMetaByAdminId"]["items"];
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
            posts.map((post, index) => {
              if (index === 0) {
                return (
                  <li key={post.id} className="row-span-3">
                    <NavigationMenuLink asChild>
                      <a
                        className="from-muted/50 to-muted flex size-full select-none flex-col justify-end rounded-md bg-gradient-to-b p-6 no-underline outline-none focus:shadow-md"
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
          <span className="i-lucide-chevron-right size-3" />
        </span>
      </NavigationMenuContent>
    </NavigationMenuItem>
  );
};

export const List: FC<{
  initialData: RouterOutputs["feeds"]["getFeedsWithMetaByAdminId"]["items"];
  query?: RouterInputs["feeds"]["getFeedsWithMetaByAdminId"];
  nextCursor?: string | number | Date;
}> = ({ initialData, nextCursor, query = {} }) => {
  const { data, isSuccess, isFetching, isError, fetchNextPage, hasNextPage } =
    api.feeds.getFeedsWithMetaByAdminId.useInfiniteQuery(
      { ...query, type: "post" },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        initialData: {
          pages: [
            {
              items: initialData,
              nextCursor: nextCursor?.toString(),
            },
          ],
          pageParams: [nextCursor?.toString()],
        },
      }
    );

  const transformData = useMemo(() => {
    if ((!isSuccess && !data) || isError) return [];
    return data.pages.flatMap((page) =>
      page.items.map((item) => {
        const { id, title, createdAt, excerpt, slug } = item;
        return {
          id,
          title,
          titleProps: {
            className: "line-clamp-1",
          },
          subtitle: dayjs(createdAt).format("MMMM D, YYYY"),
          startDate: createdAt,
          content: excerpt,
          link: `/posts/${slug}`,
        } satisfies TimelineTypes.Data;
      })
    );
  }, [data, isSuccess, isError]);

  return (
    <Timeline
      experimental={{
        enableViewTransition: true,
      }}
      data={transformData}
      enableSort={false}
      asyncDataStatus={{
        hasMore: hasNextPage,
        isLoading: isFetching,
        isError,
      }}
      onEndReached={fetchNextPage}
    />
  );
};
