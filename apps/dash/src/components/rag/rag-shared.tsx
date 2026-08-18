"use client";

import { Chip, ProgressBar, Tooltip } from "@heroui/react";

import { cn } from "@chia/ui/utils/cn.util";

import type { RouterOutputs } from "@/libs/orpc/types";

export const FEED_TRANSLATION_SOURCE_TYPE = "feed_translation";

export type ChunkState =
  RouterOutputs["rag"]["resource:status"]["chunks"][number]["state"];
export type IndexCounts = RouterOutputs["rag"]["overview"]["counts"];
export type RunStatus = RouterOutputs["rag"]["run:get"]["run"]["status"];

const STATE_META = {
  current: {
    label: "Embedded on the current index key",
    className: "bg-success",
  },
  stale: {
    label: "Only has a vector from an older index key",
    className: "bg-warning",
  },
  missing: { label: "No vector at all", className: "bg-muted-foreground" },
} satisfies Record<ChunkState, { label: string; className: string }>;

export const StateDot = ({
  state,
  className,
}: {
  state: ChunkState;
  className?: string;
}) => {
  const meta = STATE_META[state];
  return (
    <Tooltip delay={300}>
      <Tooltip.Trigger>
        <span
          aria-label={meta.label}
          className={cn(
            "inline-block size-2.5 shrink-0 rounded-full",
            meta.className,
            className
          )}
        />
      </Tooltip.Trigger>
      <Tooltip.Content>
        <p className="text-xs">{meta.label}</p>
      </Tooltip.Content>
    </Tooltip>
  );
};

/**
 * Coverage of the current index key.
 *
 * `stale` counts against coverage rather than for it: a vector computed under an older
 * key is not reachable by any query the server issues today.
 */
export const CoverageBar = ({
  counts,
  className,
}: {
  counts: IndexCounts;
  className?: string;
}) => {
  const percent =
    counts.total === 0 ? 0 : Math.round((counts.current / counts.total) * 100);

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="text-muted-foreground flex items-center justify-between text-xs">
        <span>
          {counts.current} / {counts.total} chunks embedded
        </span>
        <span>{percent}%</span>
      </div>
      <ProgressBar aria-label="Embedding coverage" size="sm" value={percent}>
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>
    </div>
  );
};

export const CountsSummary = ({ counts }: { counts: IndexCounts }) => (
  <div className="flex flex-wrap items-center gap-1.5">
    {counts.total === 0 ? (
      <Chip size="sm" variant="soft">
        <Chip.Label>Not indexed</Chip.Label>
      </Chip>
    ) : (
      <>
        <Chip color="success" size="sm" variant="soft">
          <Chip.Label>{counts.current} current</Chip.Label>
        </Chip>
        {counts.stale > 0 && (
          <Chip color="warning" size="sm" variant="soft">
            <Chip.Label>{counts.stale} stale</Chip.Label>
          </Chip>
        )}
        {counts.missing > 0 && (
          <Chip size="sm" variant="soft">
            <Chip.Label>{counts.missing} missing</Chip.Label>
          </Chip>
        )}
      </>
    )}
  </div>
);

const RUN_STATUS_COLOR = {
  pending: "default",
  running: "warning",
  completed: "success",
  failed: "danger",
  cancelled: "default",
} satisfies Record<RunStatus, "default" | "success" | "warning" | "danger">;

export const RunStatusChip = ({ status }: { status: RunStatus }) => (
  <Chip color={RUN_STATUS_COLOR[status]} size="sm" variant="soft">
    <Chip.Label>{status}</Chip.Label>
  </Chip>
);

/** The `(model, index_version)` pair every number on screen is relative to. */
export const IndexKeyLine = ({
  model,
  indexVersion,
  className,
}: {
  model: string;
  indexVersion: string;
  className?: string;
}) => (
  <p className={cn("text-muted-foreground font-mono text-xs", className)}>
    {model} · {indexVersion}
  </p>
);

export const formatDuration = (
  from: Date | string | null,
  to: Date | string | null
): string => {
  if (!from) return "—";
  const start = new Date(from).getTime();
  const end = to ? new Date(to).getTime() : Date.now();
  const seconds = Math.max(0, Math.round((end - start) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
};
