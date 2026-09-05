"use client";

import { useCallback, useState } from "react";

import {
  Button,
  Drawer,
  Spinner,
  Table,
  TableLayout,
  Tooltip,
  Virtualizer,
} from "@heroui/react";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { RefreshCwIcon, ScanSearchIcon } from "lucide-react";
import { toast } from "sonner";

import type { Locale } from "@chia/db/types";

import { DrawerPanel } from "@/components/commons/drawer-panel";
import { orpc } from "@/libs/orpc/client";
import type { RouterOutputs } from "@/libs/orpc/types";

import {
  CountsSummary,
  CoverageBar,
  FEED_TRANSLATION_SOURCE_TYPE,
  IndexKeyLine,
  RunStatusChip,
  StateDot,
} from "./rag-shared";
import { useIndexRun } from "./use-index-run";
import type { IndexRun } from "./use-index-run";

type ResourceStatus = RouterOutputs["rag"]["resource:status"];

export interface EmbeddingResource {
  locale: Locale;
  /** `feed_translation.id`; the resource layer indexes this, not the feed id. */
  sourceId: number;
}

interface Props {
  feedId: number;
  resources: EmbeddingResource[];
}

const CHUNK_COLUMNS = [
  { uid: "state", name: "State", minWidth: 80 },
  { uid: "kind", name: "Kind", minWidth: 96 },
  { uid: "chunkIndex", name: "#", minWidth: 64 },
  { uid: "headingPath", name: "Heading", minWidth: 192 },
  { uid: "tokenCount", name: "Tokens", minWidth: 96 },
];

const settledMessage = (run: IndexRun): string => {
  if (run.status === "completed") return "Embedding finished";
  if (run.status === "cancelled") return "Embedding run was cancelled";
  return run.error ?? "Embedding run failed";
};

const ChunkTable = ({ chunks }: { chunks: ResourceStatus["chunks"] }) => (
  <Virtualizer
    layout={TableLayout}
    layoutOptions={{
      rowHeight: 42,
    }}>
    <Table>
      <Table.Content
        aria-label="Chunks"
        className="max-h-72 min-h-48 overflow-auto rounded-2xl">
        <Table.Header>
          {CHUNK_COLUMNS.map((column) => (
            <Table.Column
              className="bg-surface-secondary"
              key={column.uid}
              id={column.uid}
              isRowHeader={column.uid === "kind"}
              minWidth={column.minWidth}>
              {column.name}
            </Table.Column>
          ))}
        </Table.Header>
        <Table.Body
          renderEmptyState={() => (
            <div className="text-foreground/70 py-4 text-center text-sm">
              No chunks for this locale yet
            </div>
          )}>
          <Table.Collection items={chunks}>
            {(chunk) => (
              <Table.Row id={chunk.chunkId}>
                <Table.Cell>
                  <StateDot state={chunk.state} />
                </Table.Cell>
                <Table.Cell>{chunk.kind}</Table.Cell>
                <Table.Cell>{chunk.chunkIndex}</Table.Cell>
                <Table.Cell>
                  <span className="text-muted-foreground line-clamp-1 text-xs">
                    {chunk.headingPath ?? "—"}
                  </span>
                </Table.Cell>
                <Table.Cell>{chunk.tokenCount ?? "—"}</Table.Cell>
              </Table.Row>
            )}
          </Table.Collection>
        </Table.Body>
      </Table.Content>
    </Table>
  </Virtualizer>
);

const ResourceSection = ({
  resource,
  status,
  isLoading,
  canTrigger,
  onInvalidate,
}: {
  resource: EmbeddingResource;
  status: ResourceStatus | undefined;
  isLoading: boolean;
  canTrigger: boolean;
  onInvalidate: () => void;
}) => {
  const [startedRunId, setStartedRunId] = useState<string | null>(null);
  // a run already in flight when the drawer opened is picked up from the read route
  const activeRunId = startedRunId ?? status?.activeRunId ?? null;

  const onSettled = useCallback(
    (run: IndexRun) => {
      setStartedRunId(null);
      onInvalidate();
      if (run.status === "completed") {
        toast.success(settledMessage(run));
      } else {
        toast.error(settledMessage(run));
      }
    },
    [onInvalidate]
  );

  const {
    run,
    isActive,
    error: runError,
  } = useIndexRun({ runId: activeRunId, onSettled });

  const trigger = useMutation(
    orpc.rag["resource:index"].mutationOptions({
      onSuccess(handle) {
        setStartedRunId(handle.runId);
        if (handle.reused) {
          toast.info("An index run was already in flight — following it");
        }
      },
      onError(error) {
        toast.error(error.message);
      },
    })
  );

  const isBusy = isActive || trigger.isPending;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{resource.locale}</span>
          {status && <CountsSummary counts={status.counts} />}
          {run && isActive && <RunStatusChip status={run.status} />}
        </div>
        <Button
          isDisabled={!canTrigger || isBusy}
          isPending={isBusy}
          size="sm"
          variant="tertiary"
          onPress={() =>
            trigger.mutate({
              sourceType: FEED_TRANSLATION_SOURCE_TYPE,
              sourceId: resource.sourceId,
            })
          }>
          <RefreshCwIcon className="size-3.5" />
          Recompute
        </Button>
      </div>

      {runError && (
        <p className="text-danger text-xs">
          Could not read the run's progress: {runError.message}
        </p>
      )}

      {isLoading && !status ? (
        <div className="flex justify-center py-4">
          <Spinner size="sm" />
        </div>
      ) : status ? (
        <>
          <CoverageBar counts={status.counts} />
          <ChunkTable chunks={status.chunks} />
        </>
      ) : null}
    </section>
  );
};

/** Client-side against `apps/service`: the trigger and `run:get` need the workflow runtime, which dash does not have. */
export const EmbeddingDrawer = ({ feedId, resources }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [feedRunId, setFeedRunId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const statuses = useQueries({
    queries: resources.map((resource) =>
      orpc.rag["resource:status"].queryOptions({
        input: {
          sourceType: FEED_TRANSLATION_SOURCE_TYPE,
          sourceId: resource.sourceId,
        },
        enabled: isOpen,
      })
    ),
  });

  const invalidateStatuses = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: orpc.rag["resource:status"].key(),
    });
  }, [queryClient]);

  const onFeedRunSettled = useCallback(
    (run: IndexRun) => {
      setFeedRunId(null);
      invalidateStatuses();
      if (run.status === "completed") {
        toast.success(settledMessage(run));
      } else {
        toast.error(settledMessage(run));
      }
    },
    [invalidateStatuses]
  );

  const feedRun = useIndexRun({
    runId: feedRunId,
    onSettled: onFeedRunSettled,
  });

  const indexFeed = useMutation(
    orpc.rag["feed:index"].mutationOptions({
      onSuccess(handle) {
        setFeedRunId(handle.runId);
        if (handle.reused) {
          toast.info("An index run was already in flight — following it");
        }
      },
      onError(error) {
        toast.error(error.message);
      },
    })
  );

  const first = statuses[0]?.data;
  // reading this drawer at all requires the same authority as triggering (adminGuard),
  // so a loaded status is the permission signal; there is nothing extra to ask for
  const canTrigger = !!first;
  const isFeedBusy = feedRun.isActive || indexFeed.isPending;

  return (
    <>
      {/* Not colour-coded by embedding state: MetaChip already carries that, and statuses only load after the drawer opens. */}
      <Tooltip delay={500}>
        <Tooltip.Trigger>
          <Button
            aria-label="Inspect embedding status"
            isIconOnly
            size="sm"
            variant="secondary"
            className="size-7"
            onPress={() => setIsOpen(true)}>
            <ScanSearchIcon className="size-4" />
          </Button>
        </Tooltip.Trigger>
        <Tooltip.Content>
          <p className="text-xs">Inspect embedding status</p>
        </Tooltip.Content>
      </Tooltip>

      <Drawer.Backdrop isOpen={isOpen} onOpenChange={setIsOpen}>
        <DrawerPanel>
          <Drawer.CloseTrigger />
          <Drawer.Header>
            <Drawer.Heading>Embedding status</Drawer.Heading>
            {first && (
              <IndexKeyLine
                indexVersion={first.indexVersion}
                model={first.model}
              />
            )}
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-6">
            {resources.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                This feed has no translations to index.
              </p>
            ) : (
              resources.map((resource, index) => (
                <ResourceSection
                  key={resource.sourceId}
                  canTrigger={canTrigger}
                  isLoading={statuses[index]?.isLoading ?? false}
                  onInvalidate={invalidateStatuses}
                  resource={resource}
                  status={statuses[index]?.data}
                />
              ))
            )}
          </Drawer.Body>
          <Drawer.Footer>
            <div className="flex w-full items-center justify-between gap-2">
              {feedRun.run && feedRun.isActive ? (
                <RunStatusChip status={feedRun.run.status} />
              ) : (
                <span />
              )}
              <Button
                isDisabled={!canTrigger || isFeedBusy}
                isPending={isFeedBusy}
                size="sm"
                onPress={() => indexFeed.mutate({ feedId })}>
                <RefreshCwIcon className="size-3.5" />
                Recompute whole feed
              </Button>
            </div>
            {feedRun.error && (
              <p className="text-danger w-full text-xs">
                Could not read the run's progress: {feedRun.error.message}
              </p>
            )}
          </Drawer.Footer>
        </DrawerPanel>
      </Drawer.Backdrop>
    </>
  );
};
