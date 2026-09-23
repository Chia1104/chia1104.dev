"use client";

import Link from "next/link";

import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownItemIndicator,
  DropdownMenu,
  DropdownPopover,
  Label,
  Tag,
  TagGroup,
} from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { orpc } from "@/libs/orpc/client";
import type { RouterOutputs } from "@/libs/orpc/types";

import { nameOf } from "../tags/form";

type FeedTag = RouterOutputs["feeds"]["details-by-id"]["tags"][number];

/** The post's tag set, written whole on every change. Tags themselves are made under Tags. */
export const PostTags = ({
  isDisabled,
  onChange,
  selected,
}: {
  isDisabled: boolean;
  onChange: (tagIds: number[]) => void;
  selected: FeedTag[];
}) => {
  const { data } = useQuery(orpc.tags.list.queryOptions());
  const all = data?.items ?? [];
  const selectedIds = new Set(selected.map((tag) => tag.id));

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm">Tags</Label>
      <div className="flex flex-wrap items-center gap-2">
        <TagGroup
          aria-label="Tags on this post"
          disabledKeys={isDisabled ? selectedIds : undefined}
          onRemove={(keys) =>
            onChange(
              selected.filter((tag) => !keys.has(tag.id)).map((tag) => tag.id)
            )
          }
          size="sm">
          <TagGroup.List items={selected}>
            {(tag) => (
              <Tag id={tag.id} textValue={tag.name}>
                {tag.name}
                <Tag.RemoveButton />
              </Tag>
            )}
          </TagGroup.List>
        </TagGroup>
        {all.length > 0 ? (
          <Dropdown>
            <Button isDisabled={isDisabled} size="sm" variant="tertiary">
              <Plus className="size-3.5" />
              <span className="text-xs">Add tag</span>
            </Button>
            <DropdownPopover placement="bottom start">
              <DropdownMenu
                aria-label="Tags"
                items={all}
                selectedKeys={selectedIds}
                selectionMode="multiple"
                onSelectionChange={(keys) =>
                  onChange(
                    keys === "all"
                      ? all.map((tag) => tag.id)
                      : all
                          .filter((tag) => keys.has(tag.id))
                          .map((tag) => tag.id)
                  )
                }>
                {(tag) => (
                  <DropdownItem id={tag.id} textValue={nameOf(tag)}>
                    <DropdownItemIndicator />
                    <span className="text-sm">{nameOf(tag)}</span>
                    <span className="text-muted ml-2 font-mono text-xs">
                      {tag.slug}
                    </span>
                  </DropdownItem>
                )}
              </DropdownMenu>
            </DropdownPopover>
          </Dropdown>
        ) : (
          <span className="text-muted text-xs">
            No tags exist yet.{" "}
            <Link className="underline" href="/tags">
              Create some
            </Link>
            .
          </span>
        )}
      </div>
    </div>
  );
};
