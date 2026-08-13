"use client";

import { useCallback, useState } from "react";

import { Button, Card, Modal, Spinner } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangleIcon,
  BrushCleaningIcon,
  RefreshCwIcon,
} from "lucide-react";
import { toast } from "sonner";

import { orpc } from "@/libs/orpc/client";

import { IndexKeyLine, RunStatusChip } from "./rag-shared";
import { useIndexRun } from "./use-index-run";
import type { IndexRun } from "./use-index-run";

/**
 * Every action on this page is confirmed, including `prune`.
 *
 * Prune deletes rows, and the only way back is paying for the embeddings again, so it
 * belongs behind the same gate as the two reindexes rather than firing on one press.
 */
type MaintenanceAction = "top-up" | "full" | "prune";

const ACTION_COPY: Record<
  MaintenanceAction,
  { title: string; description: string; confirm: string; destructive?: true }
> = {
  "top-up": {
    title: "Top up missing vectors",
    description:
      "Leaves every chunk's text alone and only embeds the ones with no vector on the current index key. Cost is predictable.",
    confirm: "Top up",
  },
  full: {
    title: "Full reindex",
    description:
      "Rebuilds every chunk before embedding it. This is what a bumped index version needs, and it spends embedding credits for the whole corpus.",
    confirm: "Reindex everything",
    destructive: true,
  },
  prune: {
    title: "Prune stale vectors",
    description:
      "Deletes every vector that is not on the current index key. Getting one back means paying for its embedding again.",
    confirm: "Drop leftover vectors",
    destructive: true,
  },
};

const settledMessage = (run: IndexRun): string => {
  if (run.status === "completed") return "Reindex finished";
  if (run.status === "cancelled") return "Reindex was cancelled";
  return run.error ?? "Reindex failed";
};

/** The numbers plan §8 requires on screen before a bulk action may be confirmed. */
const ConfirmActionModal = ({
  action,
  isPending,
  onCancel,
  onConfirm,
}: {
  action: MaintenanceAction | null;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) => {
  const { data, isLoading } = useQuery(
    orpc.rag["reindex:all:preview"].queryOptions({ enabled: action !== null })
  );

  const copy = action ? ACTION_COPY[action] : null;

  // exactly the rows `embeddings:prune` deletes — everything off the current key
  const leftoverVectors = data
    ? data.byIndexKey
        .filter(
          (row) =>
            row.model !== data.model || row.indexVersion !== data.indexVersion
        )
        .reduce((total, row) => total + row.count, 0)
    : 0;

  return (
    <Modal>
      <Modal.Backdrop
        isOpen={action !== null}
        onOpenChange={(open) => {
          if (!open) onCancel();
        }}>
        <Modal.Container placement="auto">
          <Modal.Dialog className="sm:max-w-md">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{copy?.title}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              <p className="text-muted-foreground text-sm">
                {copy?.description}
              </p>

              {isLoading || !data ? (
                <div className="flex justify-center py-4">
                  <Spinner size="sm" />
                </div>
              ) : (
                <>
                  <dl className="grid grid-cols-2 gap-y-1 text-sm">
                    {action === "prune" ? (
                      <>
                        <dt className="text-muted-foreground">
                          Vectors to drop
                        </dt>
                        <dd className="text-right font-mono tabular-nums">
                          {leftoverVectors}
                        </dd>
                        <dt className="text-muted-foreground">
                          Chunks left without a vector
                        </dt>
                        <dd className="text-right font-mono tabular-nums">
                          {data.needingEmbedding}
                        </dd>
                      </>
                    ) : (
                      <>
                        <dt className="text-muted-foreground">Resources</dt>
                        <dd className="text-right font-mono tabular-nums">
                          {data.targets}
                        </dd>
                        <dt className="text-muted-foreground">Chunks</dt>
                        <dd className="text-right font-mono tabular-nums">
                          {data.counts.total}
                        </dd>
                        <dt className="text-muted-foreground">
                          Chunks needing a vector
                        </dt>
                        <dd className="text-right font-mono tabular-nums">
                          {data.needingEmbedding}
                        </dd>
                      </>
                    )}
                  </dl>
                  <IndexKeyLine
                    indexVersion={data.indexVersion}
                    model={data.model}
                  />
                </>
              )}

              {action === "full" && (
                <div className="flex items-start gap-3 rounded-lg bg-amber-500/10 p-3">
                  <AlertTriangleIcon className="text-warning mt-0.5 size-5 shrink-0" />
                  <p className="text-sm">
                    Every chunk is rewritten and re-embedded. Run this only
                    after bumping the index version.
                  </p>
                </div>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button isDisabled={isPending} variant="ghost" onPress={onCancel}>
                Cancel
              </Button>
              <Button
                isDisabled={
                  !data || (action === "prune" && leftoverVectors === 0)
                }
                isPending={isPending}
                variant={copy?.destructive ? "danger" : "primary"}
                onPress={onConfirm}>
                {copy?.confirm}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};

export const RagMaintenance = () => {
  const queryClient = useQueryClient();
  const [action, setAction] = useState<MaintenanceAction | null>(null);
  const [startedRunId, setStartedRunId] = useState<string | null>(null);

  const overview = useQuery(orpc.rag.overview.queryOptions());
  // every RAG route is adminGuard(), so a loaded overview already proves the authority
  const canTrigger = !!overview.data;
  // a bulk run started before this page was opened is reported by the overview
  const activeRunId = startedRunId ?? overview.data?.activeRunId ?? null;

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: orpc.rag.key() });
  }, [queryClient]);

  const onSettled = useCallback(
    (run: IndexRun) => {
      setStartedRunId(null);
      invalidate();
      if (run.status === "completed") {
        toast.success(settledMessage(run));
      } else {
        toast.error(settledMessage(run));
      }
    },
    [invalidate]
  );

  const { run, isActive } = useIndexRun({ runId: activeRunId, onSettled });

  const reindex = useMutation(
    orpc.rag["reindex:all"].mutationOptions({
      onSuccess(handle) {
        setAction(null);
        setStartedRunId(handle.runId);
        toast.info(
          handle.reused
            ? "A reindex was already in flight — following it"
            : "Reindex started"
        );
      },
      onError(error) {
        toast.error(error.message);
      },
    })
  );

  const prune = useMutation(
    orpc.rag["embeddings:prune"].mutationOptions({
      onSuccess(result) {
        setAction(null);
        invalidate();
        toast.success(
          result.deletedCount === 0
            ? "No leftover vectors to drop"
            : `Dropped ${result.deletedCount} leftover vectors`
        );
      },
      onError(error) {
        toast.error(error.message);
      },
    })
  );

  const isBusy = isActive || reindex.isPending;

  return (
    <div className="flex w-full flex-col gap-6">
      <Card className="w-full">
        <Card.Header>
          <Card.Title className="text-sm">Current index key</Card.Title>
          <Card.Description className="text-xs">
            Every vector computed under a different key counts as stale.
          </Card.Description>
        </Card.Header>
        <Card.Content className="flex items-center justify-between gap-4">
          {overview.data ? (
            <IndexKeyLine
              className="text-sm"
              indexVersion={overview.data.indexVersion}
              model={overview.data.model}
            />
          ) : (
            <Spinner size="sm" />
          )}
          {run && isActive && <RunStatusChip status={run.status} />}
        </Card.Content>
      </Card>

      {run && isActive && run.progress && (
        <p className="text-muted-foreground font-mono text-xs tabular-nums">
          {run.progress.done} / {run.progress.total} resources
          {run.progress.failed.length > 0 &&
            ` · ${run.progress.failed.length} failed`}
        </p>
      )}

      <Card className="w-full">
        <Card.Header>
          <Card.Title className="text-sm">Maintenance</Card.Title>
        </Card.Header>
        <Card.Content className="flex flex-row flex-wrap gap-2">
          <Button
            isDisabled={!canTrigger || isBusy}
            isPending={isBusy}
            variant="primary"
            onPress={() => setAction("top-up")}>
            <RefreshCwIcon className="size-4" />
            Top up missing
          </Button>
          <Button
            isDisabled={!canTrigger || isBusy}
            isPending={isBusy}
            variant="danger"
            onPress={() => setAction("full")}>
            <RefreshCwIcon className="size-4" />
            Full reindex
          </Button>
          {/* `isActive` matters here: pruning mid-run would delete rows the run is still writing */}
          <Button
            isDisabled={!canTrigger || isActive || prune.isPending}
            isPending={prune.isPending}
            variant="tertiary"
            onPress={() => setAction("prune")}>
            <BrushCleaningIcon className="size-4" />
            Prune stale vectors
          </Button>
        </Card.Content>
      </Card>

      <ConfirmActionModal
        action={action}
        isPending={reindex.isPending || prune.isPending}
        onCancel={() => setAction(null)}
        onConfirm={() => {
          if (action === "prune") {
            prune.mutate({});
          } else if (action) {
            reindex.mutate({ onlyMissing: action === "top-up" });
          }
        }}
      />
    </div>
  );
};
