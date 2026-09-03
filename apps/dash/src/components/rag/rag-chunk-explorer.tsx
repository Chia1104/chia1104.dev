"use client";

import { useMemo, useState } from "react";

import {
  Button,
  Drawer,
  Input,
  ListBox,
  Select,
  Spinner,
  Table,
  TextField,
  Virtualizer,
  TableLayout,
  Card,
} from "@heroui/react";
import { useDebouncedValue } from "@tanstack/react-pacer";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { SearchIcon } from "lucide-react";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";

import { Locale } from "@chia/db/types";

import { DrawerPanel } from "@/components/commons/drawer-panel";
import { orpc } from "@/libs/orpc/client";
import type { RouterInputs } from "@/libs/orpc/types";

import { IndexKeyLine, StateDot } from "./rag-shared";
import type { ChunkState } from "./rag-shared";

type Query = RouterInputs["rag"]["chunks:list"];

const ANY = "any";
const SEARCH_DEBOUNCE_MS = 300;

const STATE_VALUES = [ANY, "current", "stale", "missing"] as const;
const KIND_VALUES = [ANY, "card", "section"] as const;
const LOCALE_VALUES = [ANY, Locale.zhTW, Locale.En] as const;

const STATE_OPTIONS: { id: (typeof STATE_VALUES)[number]; label: string }[] = [
  { id: ANY, label: "Any state" },
  { id: "current", label: "Current" },
  { id: "stale", label: "Stale" },
  { id: "missing", label: "Missing" },
];

const KIND_OPTIONS: { id: (typeof KIND_VALUES)[number]; label: string }[] = [
  { id: ANY, label: "Any kind" },
  { id: "card", label: "Card" },
  { id: "section", label: "Section" },
];

const LOCALE_OPTIONS: { id: (typeof LOCALE_VALUES)[number]; label: string }[] =
  [
    { id: ANY, label: "Any locale" },
    { id: Locale.zhTW, label: "zh-TW" },
    { id: Locale.En, label: "EN" },
  ];

const COLUMNS = [
  { uid: "state", name: "State", minWidth: 112 },
  { uid: "source", name: "Source", minWidth: 192 },
  { uid: "kind", name: "Kind", minWidth: 128 },
  { uid: "headingPath", name: "Heading", minWidth: 192 },
  { uid: "preview", name: "Preview", minWidth: 320 },
  { uid: "tokenCount", name: "Tokens", minWidth: 96 },
];

/** Full text of one chunk, fetched only when a row is opened. */
const ChunkDetailDrawer = ({
  chunkId,
  onClose,
}: {
  chunkId: number | null;
  onClose: () => void;
}) => {
  const { data, isLoading, error } = useQuery(
    orpc.rag["chunk:get"].queryOptions({
      input: { chunkId: chunkId ?? 0 },
      enabled: chunkId !== null,
    })
  );

  return (
    <Drawer.Backdrop
      isOpen={chunkId !== null}
      onOpenChange={(open) => !open && onClose()}>
      <DrawerPanel>
        <Drawer.CloseTrigger />
        <Drawer.Header>
          <Drawer.Heading>Chunk {chunkId}</Drawer.Heading>
          {data && (
            <IndexKeyLine indexVersion={data.indexVersion} model={data.model} />
          )}
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner size="sm" />
            </div>
          ) : error || !data ? (
            // without this branch a failed fetch leaves `data` undefined and spins forever
            <p className="text-danger py-8 text-sm">
              {error?.message ?? "Could not load this chunk"}
            </p>
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <dt className="text-muted-foreground">Source</dt>
                <dd className="font-mono">
                  {data.chunk.sourceType}:{data.chunk.sourceId}
                </dd>
                <dt className="text-muted-foreground">Kind / index</dt>
                <dd className="font-mono">
                  {data.chunk.kind} #{data.chunk.chunkIndex}
                </dd>
                <dt className="text-muted-foreground">Heading</dt>
                <dd className="font-mono">{data.chunk.headingPath ?? "—"}</dd>
                <dt className="text-muted-foreground">Tokens</dt>
                <dd className="font-mono">{data.chunk.tokenCount ?? "—"}</dd>
                <dt className="text-muted-foreground">Content hash</dt>
                <dd className="truncate font-mono">{data.chunk.contentHash}</dd>
              </dl>

              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">
                  Stored vectors
                </span>
                {data.chunk.vectors.length === 0 ? (
                  <span className="text-xs">None</span>
                ) : (
                  data.chunk.vectors.map((vector) => (
                    <span
                      key={`${vector.model}:${vector.indexVersion}`}
                      className="font-mono text-xs">
                      {vector.model} · {vector.indexVersion}
                    </span>
                  ))
                )}
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">Content</span>
                <Card variant="tertiary" className="rounded-md p-2 text-xs">
                  <Card.Content>{data.chunk.content}</Card.Content>
                </Card>
              </div>
            </>
          )}
        </Drawer.Body>
      </DrawerPanel>
    </Drawer.Backdrop>
  );
};

export const RagChunkExplorer = () => {
  const [params, setParams] = useQueryStates(
    {
      q: parseAsString.withDefault(""),
      state: parseAsStringLiteral(STATE_VALUES).withDefault(ANY),
      kind: parseAsStringLiteral(KIND_VALUES).withDefault(ANY),
      locale: parseAsStringLiteral(LOCALE_VALUES).withDefault(ANY),
    },
    { history: "replace" }
  );

  const [openChunkId, setOpenChunkId] = useState<number | null>(null);
  const [debouncedSearch] = useDebouncedValue(params.q.trim(), {
    wait: SEARCH_DEBOUNCE_MS,
  });

  // SAFETY: each non-sentinel value originates from its corresponding typed filter option.
  const filters = useMemo<Query>(
    () => ({
      query: debouncedSearch || undefined,
      state:
        params.state === ANY
          ? undefined
          : /* SAFETY: The producer contract guarantees this value satisfies ChunkState. */ (params.state as ChunkState),
      kind:
        params.kind === ANY
          ? undefined
          : /* SAFETY: The producer contract guarantees this value satisfies Query["kind"]. */ (params.kind as Query["kind"]),
      locale:
        params.locale === ANY
          ? undefined
          : /* SAFETY: The producer contract guarantees this value satisfies Locale. */ (params.locale as Locale),
    }),
    [debouncedSearch, params.state, params.kind, params.locale]
  );

  const {
    data,
    isSuccess,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery(
    orpc.rag["chunks:list"].infiniteOptions({
      input: (pageParam) => ({ ...filters, cursor: pageParam }),
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? null,
      initialPageParam:
        /* SAFETY: The producer contract guarantees this value satisfies number | null. */ null as
          | number
          | null,
    })
  );

  const rows = useMemo(() => {
    if (!isSuccess || !data) return [];
    return data.pages.flatMap((page) => page.items);
  }, [data, isSuccess]);

  const indexKey = data?.pages[0];

  return (
    <div className="flex w-full flex-col gap-4">
      {indexKey && (
        <IndexKeyLine
          indexVersion={indexKey.indexVersion}
          model={indexKey.model}
        />
      )}

      <div className="flex flex-wrap items-end gap-2">
        <TextField
          aria-label="Search chunk content"
          className="relative min-w-56 flex-1"
          onChange={(value) => void setParams({ q: value.trim() || null })}
          value={params.q}>
          <div className="relative">
            <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 z-10 size-3.5 -translate-y-1/2" />
            <Input className="pl-8" placeholder="Search content..." />
          </div>
        </TextField>

        <Select
          aria-label="Embedding state"
          className="w-40"
          onChange={(key) =>
            void setParams({
              state:
                /* SAFETY: The producer contract guarantees this value satisfies (typeof STATE_VALUES)[number]. */ String(
                  key
                ) as (typeof STATE_VALUES)[number],
            })
          }
          value={params.state}>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox items={STATE_OPTIONS}>
              {(item) => <ListBox.Item id={item.id}>{item.label}</ListBox.Item>}
            </ListBox>
          </Select.Popover>
        </Select>

        <Select
          aria-label="Chunk kind"
          className="w-36"
          onChange={(key) =>
            void setParams({
              kind: /* SAFETY: The producer contract guarantees this value satisfies (typeof KIND_VALUES)[number]. */ String(
                key
              ) as (typeof KIND_VALUES)[number],
            })
          }
          value={params.kind}>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox items={KIND_OPTIONS}>
              {(item) => <ListBox.Item id={item.id}>{item.label}</ListBox.Item>}
            </ListBox>
          </Select.Popover>
        </Select>

        <Select
          aria-label="Locale"
          className="w-36"
          onChange={(key) =>
            void setParams({
              locale:
                /* SAFETY: The producer contract guarantees this value satisfies (typeof LOCALE_VALUES)[number]. */ String(
                  key
                ) as (typeof LOCALE_VALUES)[number],
            })
          }
          value={params.locale}>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox items={LOCALE_OPTIONS}>
              {(item) => <ListBox.Item id={item.id}>{item.label}</ListBox.Item>}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      <Virtualizer
        layout={TableLayout}
        layoutOptions={{
          rowHeight: 42,
        }}>
        <Table>
          <Table.Content
            aria-label="Resource chunks"
            className="max-h-125 min-h-96 overflow-auto rounded-2xl">
            <Table.Header>
              {COLUMNS.map((column) => (
                <Table.Column
                  className="bg-surface-secondary"
                  key={column.uid}
                  id={column.uid}
                  isRowHeader={column.uid === "source"}
                  minWidth={column.minWidth}>
                  {column.name}
                </Table.Column>
              ))}
            </Table.Header>
            <Table.Body
              renderEmptyState={() => (
                <div className="text-foreground/70 py-4 text-center text-sm">
                  {isLoading ? "Loading..." : "No chunks match these filters"}
                </div>
              )}>
              <Table.Collection items={rows}>
                {(chunk) => (
                  <Table.Row id={chunk.chunkId}>
                    <Table.Cell>
                      <StateDot state={chunk.state} />
                    </Table.Cell>
                    <Table.Cell className="flex items-center">
                      <Button
                        className="py-0 font-mono text-xs"
                        size="sm"
                        variant="ghost"
                        onPress={() => setOpenChunkId(chunk.chunkId)}>
                        {chunk.sourceType}:{chunk.sourceId}
                      </Button>
                    </Table.Cell>
                    <Table.Cell>
                      {chunk.kind} #{chunk.chunkIndex}
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-muted-foreground line-clamp-1 max-w-40 text-xs">
                        {chunk.headingPath ?? "—"}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="line-clamp-1 max-w-80 text-xs">
                        {chunk.preview}
                      </span>
                    </Table.Cell>
                    <Table.Cell>{chunk.tokenCount ?? "—"}</Table.Cell>
                  </Table.Row>
                )}
              </Table.Collection>
              {hasNextPage && isSuccess && (
                <Table.LoadMore
                  isLoading={isFetchingNextPage}
                  scrollOffset={0}
                  onLoadMore={() => fetchNextPage()}>
                  <Table.LoadMoreContent>
                    <Spinner size="sm" />
                  </Table.LoadMoreContent>
                </Table.LoadMore>
              )}
            </Table.Body>
          </Table.Content>
        </Table>
      </Virtualizer>

      <ChunkDetailDrawer
        chunkId={openChunkId}
        onClose={() => setOpenChunkId(null)}
      />
    </div>
  );
};
