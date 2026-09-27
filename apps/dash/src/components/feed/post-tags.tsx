"use client";

import Link from "next/link";

import {
  Autocomplete,
  EmptyState,
  Label,
  ListBox,
  SearchField,
  Tag,
  TagGroup,
  useFilter,
} from "@heroui/react";
import type { Key } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/libs/orpc/client";

import { nameOf } from "../tags/form";

/** The tag ids among `keys`; the list box only offers known tags, so nothing else appears. */
const idsOf = (keys: Key | Key[] | null, known: { id: number }[]): number[] => {
  const chosen = new Set(
    keys === null ? [] : Array.isArray(keys) ? keys : [keys]
  );
  return known.filter((tag) => chosen.has(tag.id)).map((tag) => tag.id);
};

/** The post's tag set, reported whole on every change. Tags themselves are made under Tags. */
export const PostTags = ({
  onChange,
  selected,
}: {
  onChange: (tagIds: number[]) => void;
  selected: number[];
}) => {
  const { contains } = useFilter({ sensitivity: "base" });
  const { data } = useQuery(
    orpc.tags.list.queryOptions({ input: { includeUnpublished: true } })
  );
  const all = data?.items ?? [];
  const chosen = all.filter((tag) => selected.includes(tag.id));

  if (all.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <Label className="text-sm">Tags</Label>
        <span className="text-muted text-xs">
          No tags exist yet.{" "}
          <Link className="underline" href="/tags">
            Create some
          </Link>
          .
        </span>
      </div>
    );
  }

  return (
    <Autocomplete
      className="w-full max-w-md"
      placeholder="Add tags"
      selectionMode="multiple"
      value={selected}
      onChange={(keys) => onChange(idsOf(keys, all))}>
      <Label className="text-sm">Tags</Label>
      <Autocomplete.Trigger>
        <Autocomplete.Value>
          {({ defaultChildren, isPlaceholder }) =>
            isPlaceholder || chosen.length === 0 ? (
              defaultChildren
            ) : (
              <TagGroup
                aria-label="Tags on this post"
                size="sm"
                onRemove={(keys) =>
                  onChange(selected.filter((id) => !keys.has(id)))
                }>
                <TagGroup.List items={chosen}>
                  {(tag) => (
                    <Tag id={tag.id} textValue={nameOf(tag)}>
                      {nameOf(tag)}
                      <Tag.RemoveButton />
                    </Tag>
                  )}
                </TagGroup.List>
              </TagGroup>
            )
          }
        </Autocomplete.Value>
        <Autocomplete.Indicator />
      </Autocomplete.Trigger>
      <Autocomplete.Popover>
        <Autocomplete.Filter filter={contains}>
          <SearchField
            autoFocus
            aria-label="Search tags"
            name="search"
            variant="secondary">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Search tags" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <ListBox
            aria-label="Tags"
            items={all}
            renderEmptyState={() => <EmptyState>No matching tag</EmptyState>}>
            {(tag) => (
              <ListBox.Item id={tag.id} textValue={nameOf(tag)}>
                <span className="text-sm">{nameOf(tag)}</span>
                <span className="text-muted ml-2 font-mono text-xs">
                  {tag.slug}
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
