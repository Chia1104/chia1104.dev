"use client";

import { useMemo } from "react";

import { Spinner, Table, TableLayout, Virtualizer } from "@heroui/react";
import { useInfiniteQuery } from "@tanstack/react-query";

import DateFormat from "@chia/ui/date-format";

import { orpc } from "@/libs/orpc/client";

import { formatDuration, IndexKeyLine, RunStatusChip } from "./rag-shared";
import { isTerminalRunStatus } from "./use-index-run";

const COLUMNS = [
  { uid: "status", name: "Status", minWidth: 128 },
  { uid: "scope", name: "Scope", minWidth: 96 },
  { uid: "target", name: "Target", minWidth: 192 },
  { uid: "progress", name: "Progress", minWidth: 160 },
  { uid: "duration", name: "Duration", minWidth: 112 },
  { uid: "createdAt", name: "Started", minWidth: 160 },
];

const POLL_INTERVAL_MS = 3000;

export const RagRunsTable = () => {
  const {
    data,
    isSuccess,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
  } = useInfiniteQuery(
    orpc.rag["runs:list"].infiniteOptions({
      input: (pageParam) => ({ cursor: pageParam }),
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? null,
      initialPageParam: null as string | number | null,
      // an in-flight run is the only thing that changes without a user action
      refetchInterval: ({ state }) =>
        state.data?.pages.some((page) =>
          page.items.some((run) => !isTerminalRunStatus(run.status))
        )
          ? POLL_INTERVAL_MS
          : false,
    })
  );

  const rows = useMemo(() => {
    if (!isSuccess || !data) return [];
    return data.pages.flatMap((page) => page.items);
  }, [data, isSuccess]);

  if (error) {
    return (
      <p className="text-danger py-8 text-sm">
        {error.message ||
          "Index runs are only readable from the service that owns the workflow runtime."}
      </p>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {data?.pages[0] && (
        <IndexKeyLine
          indexVersion={data.pages[0].indexVersion}
          model={data.pages[0].model}
        />
      )}

      <Virtualizer
        layout={TableLayout}
        layoutOptions={{
          rowHeight: 42,
        }}>
        <Table>
          <Table.ScrollContainer>
            <Table.Content
              aria-label="Index runs"
              className="max-h-125 min-h-96 overflow-auto rounded-2xl">
              <Table.Header>
                {COLUMNS.map((column) => (
                  <Table.Column
                    className="bg-surface-secondary"
                    key={column.uid}
                    id={column.uid}
                    isRowHeader={column.uid === "status"}
                    minWidth={column.minWidth}>
                    {column.name}
                  </Table.Column>
                ))}
              </Table.Header>
              <Table.Body
                renderEmptyState={() => (
                  <div className="text-foreground/70 py-4 text-center text-sm">
                    {isLoading ? "Loading..." : "No index runs yet"}
                  </div>
                )}>
                <Table.Collection items={rows}>
                  {(run) => (
                    <Table.Row id={run.recordId}>
                      <Table.Cell>
                        <RunStatusChip status={run.status} />
                      </Table.Cell>
                      <Table.Cell>{run.scope}</Table.Cell>
                      <Table.Cell>
                        <span className="font-mono text-xs">
                          {run.scope === "all"
                            ? "every resource"
                            : run.sourceType
                              ? `${run.sourceType}:${run.sourceId}`
                              : `feed:${run.feedId}`}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        {run.progress ? (
                          <span className="font-mono text-xs tabular-nums">
                            {run.progress.done} / {run.progress.total}
                            {run.progress.failed.length > 0 &&
                              ` · ${run.progress.failed.length} failed`}
                          </span>
                        ) : (
                          "—"
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        <span className="font-mono text-xs">
                          {formatDuration(run.startedAt, run.endedAt)}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <DateFormat date={run.createdAt} />
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
      </Virtualizer>
    </div>
  );
};
