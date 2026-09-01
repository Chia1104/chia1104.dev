"use client";

import type { ReactNode } from "react";

import { Chip } from "@heroui/react";

import { cn } from "@chia/ui/utils/cn.util";

import { Composer } from "./composer.tsx";
import { EmptyState } from "./empty-state.tsx";
import type { EmptyStateProps } from "./empty-state.tsx";
import { useAgentLabels } from "./labels-context.tsx";
import { useAgentStatus } from "./provider.tsx";
import { Thread } from "./thread.tsx";
import type { ToolRenderers } from "./tool-call.tsx";

export const StatusChip = ({ className }: { className?: string }) => {
  const labels = useAgentLabels();
  const status = useAgentStatus();
  const meta = {
    running: { color: "accent", label: labels.statusStreaming },
    awaiting_approval: {
      color: "warning",
      label: labels.statusAwaitingApproval,
    },
    error: { color: "danger", label: labels.toolFailed },
    idle: { color: "default", label: labels.statusReady },
  } as const;
  return (
    <Chip
      className={className}
      color={meta[status].color}
      size="sm"
      variant="soft">
      <Chip.Label>{meta[status].label}</Chip.Label>
    </Chip>
  );
};

export interface AgentChatProps {
  header?: ReactNode;
  renderers?: ToolRenderers;
  empty?: EmptyStateProps;
  composerPlaceholder?: string;
  className?: string;
}

/** Kind-specific panels sit beside or above this in the host. */
export const AgentChat = ({
  className,
  composerPlaceholder,
  empty,
  header,
  renderers,
}: AgentChatProps) => (
  <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
    {header}
    <Thread empty={<EmptyState {...empty} />} renderers={renderers} />
    <Composer placeholder={composerPlaceholder} />
  </div>
);
