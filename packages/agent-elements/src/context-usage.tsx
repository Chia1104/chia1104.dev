"use client";

import { Button, Popover, ProgressBar } from "@heroui/react";
import { Archive } from "lucide-react";

import { cn } from "@chia/ui/utils/cn.util";

import { useAgentLabels } from "./labels-context.tsx";
import { fill } from "./labels.ts";
import {
  useAgentBusy,
  useAgentModels,
  useCompactSession,
  useSessionDetail,
} from "./provider.tsx";

const RING_RADIUS = 7;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const TOKEN_UNITS = [
  { threshold: 1_000_000_000, suffix: "b" },
  { threshold: 1_000_000, suffix: "m" },
  { threshold: 1_000, suffix: "k" },
] as const;

const formatCompactTokens = (value: number) => {
  const unit = TOKEN_UNITS.find(({ threshold }) => value >= threshold);
  if (!unit) return Math.round(value).toString();

  const scaled = value / unit.threshold;
  const digits = scaled >= 100 ? 0 : 1;
  return `${Number(scaled.toFixed(digits))}${unit.suffix}`;
};

/**
 * The server refuses compaction mid-turn and when nothing would condense; the button is
 * disabled on the same two readings.
 */
export const ContextUsage = () => {
  const labels = useAgentLabels();
  const detail = useSessionDetail().data;
  const models = useAgentModels().data;
  const busy = useAgentBusy();
  const compact = useCompactSession();
  const settings = detail?.settings;
  const current = settings
    ? models?.find(
        (model) =>
          model.providerId === settings.providerId &&
          model.modelId === settings.modelId
      )
    : undefined;

  if (!detail || !current || current.contextWindow <= 0) return null;

  const { compactable, contextTokens } = detail.stats;
  const percentage = Math.round((contextTokens / current.contextWindow) * 100);
  const visualPercentage = Math.min(100, Math.max(0, percentage));
  const tone =
    percentage >= 90 ? "danger" : percentage >= 75 ? "warning" : "default";
  const ringClassName =
    percentage >= 90
      ? "stroke-danger"
      : percentage >= 75
        ? "stroke-warning"
        : "stroke-muted";
  const ringOffset = RING_CIRCUMFERENCE * (1 - visualPercentage / 100);

  return (
    <Popover>
      <Popover.Trigger>
        <Button
          aria-label={`${labels.contextWindow}: ${percentage}%`}
          className="size-7 rounded-full p-1"
          isIconOnly
          size="sm"
          variant="ghost">
          <svg
            aria-hidden="true"
            className="size-5 -rotate-90"
            viewBox="0 0 20 20">
            <circle
              className="stroke-border"
              cx="10"
              cy="10"
              fill="none"
              r={RING_RADIUS}
              strokeWidth="2.5"
            />
            <circle
              className={cn(
                "transition-[stroke-dashoffset] duration-500 motion-reduce:transition-none",
                ringClassName
              )}
              cx="10"
              cy="10"
              fill="none"
              r={RING_RADIUS}
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={ringOffset}
              strokeLinecap="round"
              strokeWidth="2.5"
            />
          </svg>
        </Button>
      </Popover.Trigger>

      <Popover.Content
        className="bg-surface/70 w-80 p-0 backdrop-blur-sm"
        offset={10}
        placement="top end">
        <Popover.Dialog className="p-4">
          <div className="flex items-baseline justify-between gap-4">
            <Popover.Heading className="text-sm font-medium">
              {labels.contextWindow}
            </Popover.Heading>
            <span className="text-muted shrink-0 text-xs tabular-nums">
              {percentage}% · {formatCompactTokens(contextTokens)}/
              {formatCompactTokens(current.contextWindow)}
            </span>
          </div>

          <ProgressBar
            aria-label={labels.contextWindow}
            className="mt-3"
            color={tone}
            size="sm"
            value={visualPercentage}>
            <ProgressBar.Track>
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar>

          <div className="mt-4 flex items-baseline justify-between gap-4 text-xs">
            <span className="text-muted">{labels.totalProcessed}</span>
            <span className="font-medium tabular-nums">
              {formatCompactTokens(detail.stats.totalTokens)}
            </span>
          </div>

          <p className="text-muted mt-4 text-xs leading-5">
            {fill(labels.contextCompactsAutomatically, {
              model: current.name,
            })}{" "}
            {compactable
              ? labels.compactDescription
              : labels.compactUnavailable}
          </p>

          <Button
            className="mt-3 w-full"
            isDisabled={busy || !compactable}
            isPending={compact.isPending}
            onPress={() => compact.mutate({})}
            size="sm"
            variant="secondary">
            <Archive className="size-3.5" />
            {labels.compactNow}
          </Button>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
};
