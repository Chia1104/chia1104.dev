"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import {
  Autocomplete,
  EmptyState,
  Label,
  ListBox,
  SearchField,
  useFilter,
} from "@heroui/react";
import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/libs/orpc/client";

import { KIND_LABEL, titleOf } from "../media/form";

/** Stands where the picker would while there is nothing to pick from. */
const Notice = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-col gap-2">
    <Label className="text-sm">About</Label>
    <span className="text-muted text-xs">{children}</span>
  </div>
);

/** The logged work an article is about, or none. Works are logged under Media. */
export const PostWork = ({
  onChange,
  selected,
}: {
  onChange: (mediaEntryId: number | null) => void;
  selected: number | null;
}) => {
  const { contains } = useFilter({ sensitivity: "base" });
  const works = useQuery(orpc.media.list.queryOptions({ input: {} }));

  if (works.isPending) return <Notice>Loading works…</Notice>;
  if (works.isError) {
    return (
      <Notice>
        The logged works could not be loaded.{" "}
        <button
          type="button"
          className="underline"
          onClick={() => void works.refetch()}>
          Try again
        </button>
        .
      </Notice>
    );
  }
  const all = works.data.items;
  if (all.length === 0) {
    return (
      <Notice>
        No works are logged yet.{" "}
        <Link className="underline" href="/media">
          Log one
        </Link>
        .
      </Notice>
    );
  }

  return (
    <Autocomplete
      className="w-full max-w-md"
      placeholder="Link a work"
      selectionMode="single"
      value={selected}
      onChange={(key) =>
        // The list box only offers logged works, so a key that matches none clears the link.
        onChange(all.find((work) => work.id === key)?.id ?? null)
      }>
      <Label className="text-sm">About</Label>
      <Autocomplete.Trigger>
        <Autocomplete.Value />
        <Autocomplete.ClearButton />
        <Autocomplete.Indicator />
      </Autocomplete.Trigger>
      <Autocomplete.Popover>
        <Autocomplete.Filter filter={contains}>
          <SearchField
            autoFocus
            aria-label="Search works"
            name="search"
            variant="secondary">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Search works" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <ListBox
            aria-label="Works"
            items={all}
            renderEmptyState={() => <EmptyState>No matching work</EmptyState>}>
            {(work) => (
              <ListBox.Item id={work.id} textValue={titleOf(work)}>
                <span className="text-sm">{titleOf(work)}</span>
                <span className="text-muted ml-2 text-xs">
                  {KIND_LABEL[work.kind]}
                </span>
                <ListBox.ItemIndicator />
              </ListBox.Item>
            )}
          </ListBox>
        </Autocomplete.Filter>
      </Autocomplete.Popover>
    </Autocomplete>
  );
};
