"use client";

import { useMemo, useState } from "react";

import { Button, Spinner, Table } from "@heroui/react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";

import { orpc } from "@/libs/orpc/client";

import { ApiKeyDrawer } from "./api-key-drawer";
import type { Editor } from "./api-key-drawer";
import { stateOf } from "./form";
import type { ApiKeyView } from "./form";
import { KeyStateChip, ScopeChips, formatDateTime } from "./shared";

/** Client-side oRPC behind `adminGuard()`. Every key belongs to the operator; the list is keyset-paged. */

const COLUMNS = [
  { uid: "name", name: "Name", minWidth: 200 },
  { uid: "scopes", name: "Scopes", minWidth: 220 },
  { uid: "state", name: "Status", minWidth: 96 },
  { uid: "lastRequest", name: "Last used", minWidth: 160 },
  { uid: "createdAt", name: "Created", minWidth: 160 },
] as const;

export const ApiKeysExplorer = () => {
  const [editor, setEditor] = useState<Editor>(null);

  const {
    data,
    error,
    isSuccess,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery(
    orpc.apikey.list.infiniteOptions({
      input: (pageParam) => ({ cursor: pageParam }),
      getNextPageParam: (lastPage) => lastPage.nextCursor?.toString() ?? null,
      initialPageParam:
        /* SAFETY: The producer contract guarantees this value satisfies string | null. */ null as
          | string
          | null,
    })
  );

  const rows = useMemo(
    () => (isSuccess && data ? data.pages.flatMap((page) => page.items) : []),
    [data, isSuccess]
  );

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-muted-foreground text-xs">
          Send a key as <span className="font-mono">x-ch-api-key</span>. It only
          opens the routes its scopes name.
        </p>
        <Button
          className="ml-auto"
          size="sm"
          variant="primary"
          onPress={() => setEditor({ mode: "create" })}>
          <PlusIcon className="size-3.5" />
          New key
        </Button>
      </div>

      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="API keys" className="rounded-2xl">
            <Table.Header>
              {COLUMNS.map((column) => (
                <Table.Column
                  className="bg-surface-secondary"
                  key={column.uid}
                  id={column.uid}
                  isRowHeader={column.uid === "name"}
                  minWidth={column.minWidth}>
                  {column.name}
                </Table.Column>
              ))}
            </Table.Header>
            <Table.Body
              renderEmptyState={() => (
                <div
                  className={
                    error
                      ? "text-danger py-4 text-center text-sm"
                      : "text-foreground/70 py-4 text-center text-sm"
                  }>
                  {isLoading ? (
                    <Spinner size="sm" />
                  ) : (
                    (error?.message ?? "No API keys yet")
                  )}
                </div>
              )}>
              <Table.Collection items={rows}>
                {(item: ApiKeyView) => (
                  <Table.Row id={item.id}>
                    <Table.Cell>
                      <Button
                        className="h-auto max-w-64 justify-start text-left"
                        size="sm"
                        variant="ghost"
                        onPress={() => setEditor({ mode: "edit", item })}>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-sm font-medium">
                            {item.name ?? "Untitled"}
                          </span>
                          <span className="text-muted-foreground truncate font-mono text-xs">
                            {item.start ?? "ch_"}…
                          </span>
                        </div>
                      </Button>
                    </Table.Cell>
                    <Table.Cell>
                      <ScopeChips permissions={item.permissions} />
                    </Table.Cell>
                    <Table.Cell>
                      <KeyStateChip state={stateOf(item)} />
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-muted-foreground text-xs">
                        {item.lastRequest
                          ? formatDateTime(item.lastRequest)
                          : "Never"}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-muted-foreground text-xs">
                        {formatDateTime(item.createdAt)}
                      </span>
                    </Table.Cell>
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
        </Table.ScrollContainer>
      </Table>

      <ApiKeyDrawer editor={editor} onClose={() => setEditor(null)} />
    </div>
  );
};
