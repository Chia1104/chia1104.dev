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

type ReindexMode = "top-up" | "full";

const MODE_COPY: Record<
  ReindexMode,
  { title: string; description: string; confirm: string }
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
  },
};

const settledMessage = (run: IndexRun): string => {
  if (run.status === "completed") return "Reindex finished";
  if (run.status === "cancelled") return "Reindex was cancelled";
  return run.error ?? "Reindex failed";
};

/** The numbers plan §8 requires on screen before a bulk run may be confirmed. */
const ConfirmReindexModal = ({
  mode,
  isPending,
  onCancel,
  onConfirm,
}: {
  mode: ReindexMode | null;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) => {
  const { data, isLoading } = useQuery(
    orpc.rag["reindex:all:preview"].queryOptions({ enabled: mode !== null })
  );

  const copy = mode ? MODE_COPY[mode] : null;

  return (
    <Modal>
      <Modal.Backdrop isOpen={mode !== null} onOpenChange={() => onCancel()}>
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
                  </dl>
                  <IndexKeyLine
                    indexVersion={data.indexVersion}
                    model={data.model}
                  />
                </>
              )}

              {mode === "full" && (
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
              <Button isPending={isPending} variant="ghost" onPress={onCancel}>
                Cancel
              </Button>
              <Button
                isDisabled={!data}
                isPending={isPending}
                variant={mode === "full" ? "danger" : "primary"}
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
  const [mode, setMode] = useState<ReindexMode | null>(null);
  const [startedRunId, setStartedRunId] = useState<string | null>(null);

  const overview = useQuery(orpc.rag.overview.queryOptions());
  const canTrigger = overview.data?.canTrigger ?? false;
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
        setMode(null);
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
            onPress={() => setMode("top-up")}>
            <RefreshCwIcon className="size-4" />
            Top up missing
          </Button>
          <Button
            isDisabled={!canTrigger || isBusy}
            isPending={isBusy}
            variant="danger"
            onPress={() => setMode("full")}>
            <RefreshCwIcon className="size-4" />
            Full reindex
          </Button>
          <Button
            isDisabled={!canTrigger || prune.isPending}
            isPending={prune.isPending}
            variant="tertiary"
            onPress={() => prune.mutate({})}>
            <BrushCleaningIcon className="size-4" />
            Prune stale vectors
          </Button>
        </Card.Content>
      </Card>

      {!canTrigger && overview.data && (
        <p className="text-muted-foreground text-xs">
          Only the configured admin can run these.
        </p>
      )}

      <ConfirmReindexModal
        isPending={reindex.isPending}
        mode={mode}
        onCancel={() => setMode(null)}
        onConfirm={() =>
          mode && reindex.mutate({ onlyMissing: mode === "top-up" })
        }
      />
    </div>
  );
};
