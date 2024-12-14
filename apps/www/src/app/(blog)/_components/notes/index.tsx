"use client";

import type { FC } from "react";
import { useMemo } from "react";

import dayjs from "dayjs";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { RouterInputs, RouterOutputs } from "@chia/api";
import {
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuTrigger,
} from "@chia/ui/navigation-menu";
import Timeline from "@chia/ui/timeline";
import type { Data } from "@chia/ui/timeline/types";
import { cn } from "@chia/ui/utils/cn.util";

import { api } from "@/trpc/client";

import ListItem from "../list-item";

export const NoteNavigation: FC<{
  notes?: RouterOutputs["feeds"]["getFeedsWithMetaByAdminId"]["items"];
}> = ({ notes }) => {
  const hasNotes = !!notes && Array.isArray(notes) && notes.length > 0;
  const router = useRouter();
  return (
    <NavigationMenuItem>
      <NavigationMenuTrigger onClick={() => router.push("/notes")}>
        Notes
      </NavigationMenuTrigger>
      <NavigationMenuContent>
        <ul
          className={cn(
            "grid w-[300px] gap-3 p-4 pb-0 md:w-[500px] lg:w-[600px]",
            hasNotes ? "md:grid-cols-2" : "max-w-[300px]"
          )}>
          {hasNotes ? (
            notes.map((note) => (
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
        <span className="flex w-full items-center justify-end gap-1 py-2 pb-5 pr-5 text-sm font-medium">
          <Link href="/notes" className="w-fit">
            View all notes
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
      { ...query, type: "note" },
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
          subtitle: dayjs(createdAt).tz("UTC").format("MMMM D, YYYY"),
          startDate: createdAt,
          content: excerpt,
          link: `/notes/${slug}`,
        } satisfies Data;
      })
    );
  }, [data, isSuccess, isError]);

  return (
    <Timeline
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
