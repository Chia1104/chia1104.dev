"use client";

import type { FC } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import type { RouterOutputs } from "@chia/api";
import {
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuTrigger,
  cn,
} from "@chia/ui";

import ListItem from "../list-item";

export const NoteNavigation: FC<{
  notes?: RouterOutputs["feeds"]["infinityByAdmin"]["items"];
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
