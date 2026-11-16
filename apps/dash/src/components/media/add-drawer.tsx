"use client";

import { useState } from "react";

import {
  Button,
  Drawer,
  Input,
  Label,
  ListBox,
  Select,
  Spinner,
  TextField,
} from "@heroui/react";
import { useDebouncedValue } from "@tanstack/react-pacer";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { MediaStatus } from "@chia/db/types";
import type { MediaKind } from "@chia/db/types";
import { isEnumValue } from "@chia/utils/is";
import { Image } from "@chiastack/ui/image";

import { DrawerPanel } from "@/components/commons/drawer-panel";
import { orpc } from "@/libs/orpc/client";

import { KIND_LABEL, STATUS_OPTIONS } from "./form";
import type { MediaCandidate, MediaEntryView } from "./form";

const SEARCH_DEBOUNCE_MS = 400;
const MIN_QUERY_CHARS = 2;

const SOURCE_LABEL = {
  "tmdb:movie": "TMDB",
  "tmdb:tv": "TMDB",
  anilist: "AniList",
  igdb: "IGDB",
} satisfies Record<MediaCandidate["source"], string>;

/**
 * Searches the catalogues of `kind` and logs the picked work. The catalogue supplies the titles
 * and cover, so only the status is asked here; `onAdded` opens the new entry for the rest.
 */
export const AddDrawer = ({
  isOpen,
  kind,
  onAdded,
  onClose,
}: {
  isOpen: boolean;
  kind: MediaKind;
  onAdded: (entry: MediaEntryView) => void;
  onClose: () => void;
}) => {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<MediaStatus>(MediaStatus.Completed);
  const [debouncedQuery] = useDebouncedValue(query.trim(), {
    wait: SEARCH_DEBOUNCE_MS,
  });
  const canSearch = debouncedQuery.length >= MIN_QUERY_CHARS;

  const search = useQuery(
    orpc.media.search.queryOptions({
      input: { kind, query: debouncedQuery },
      enabled: isOpen && canSearch,
      retry: false,
    })
  );

  const create = useMutation(
    orpc.media.create.mutationOptions({
      onSuccess({ entry }) {
        setQuery("");
        onAdded(entry);
        toast.success("Logged; add your rating and dates");
      },
      onError(error) {
        toast.error(error.message);
      },
    })
  );

  const candidates = canSearch ? (search.data?.items ?? []) : [];

  return (
    <Drawer.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}>
      <DrawerPanel>
        <Drawer.CloseTrigger />
        <Drawer.Header>
          <Drawer.Heading>{`Log ${KIND_LABEL[kind].toLowerCase()}`}</Drawer.Heading>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <TextField
              autoFocus
              className="min-w-48 flex-1"
              onChange={setQuery}
              value={query}>
              <Label className="text-xs">Title</Label>
              <Input placeholder="Search the catalogue" variant="secondary" />
            </TextField>
            <Select
              className="w-40"
              onChange={(key) => {
                if (key !== null && isEnumValue(MediaStatus, key))
                  setStatus(key);
              }}
              value={status}
              variant="secondary">
              <Label className="text-xs">Log as</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox items={STATUS_OPTIONS}>
                  {(item) => (
                    <ListBox.Item id={item.id}>{item.label}</ListBox.Item>
                  )}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>

          {search.isError ? (
            <p className="text-danger text-sm">
              The catalogue did not answer: {search.error.message}
            </p>
          ) : null}
          {canSearch && search.isFetching ? (
            <div className="flex justify-center py-6">
              <Spinner size="sm" />
            </div>
          ) : null}
          {canSearch && search.isSuccess && candidates.length === 0 ? (
            <p className="text-muted text-sm">
              Nothing matches “{debouncedQuery}”. Try the original title.
            </p>
          ) : null}

          <ul className="flex flex-col gap-2">
            {candidates.map((candidate) => (
              <li
                key={`${candidate.source}:${candidate.sourceId}`}
                className="border-separator flex items-center gap-3 rounded-xl border p-2">
                <div className="bg-default relative aspect-2/3 w-12 shrink-0 overflow-hidden rounded-md">
                  {candidate.posterUrl ? (
                    <Image.Root>
                      <Image.Resource
                        src={candidate.posterUrl}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    </Image.Root>
                  ) : null}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <a
                    className="truncate text-sm font-medium hover:underline"
                    href={candidate.url}
                    rel="noopener noreferrer"
                    target="_blank">
                    {candidate.title}
                  </a>
                  <span className="text-muted truncate text-xs">
                    {[
                      candidate.releaseYear,
                      candidate.originalTitle === candidate.title
                        ? null
                        : candidate.originalTitle,
                      SOURCE_LABEL[candidate.source],
                    ]
                      .filter((part) => part !== null)
                      .join(" · ")}
                  </span>
                </div>
                <Button
                  isDisabled={create.isPending}
                  isPending={
                    create.isPending &&
                    create.variables.source === candidate.source &&
                    create.variables.sourceId === candidate.sourceId
                  }
                  size="sm"
                  variant="secondary"
                  onPress={() =>
                    create.mutate({
                      kind,
                      source: candidate.source,
                      sourceId: candidate.sourceId,
                      status,
                      rating: null,
                      favorite: false,
                      startedOn: null,
                      finishedOn: null,
                    })
                  }>
                  Log
                </Button>
              </li>
            ))}
          </ul>
        </Drawer.Body>
      </DrawerPanel>
    </Drawer.Backdrop>
  );
};
