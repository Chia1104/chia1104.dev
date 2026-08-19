"use client";

import type { ReactNode } from "react";

import { Chip } from "@heroui/react";

import { cn } from "@chia/ui/utils/cn.util";

import { Composer } from "./composer.tsx";
import { EmptyState } from "./empty-state.tsx";
import type { EmptyStateProps } from "./empty-state.tsx";
import { useAgentLabels, useAgentSession } from "./provider.tsx";
import { selectStatus } from "./store.ts";
import { Thread } from "./thread.tsx";
import type { ToolRenderers } from "./tool-call.tsx";

/** The session's status as a chip, for a host header. */
export const StatusChip = ({ className }: { className?: string }) => {
  const labels = useAgentLabels();
  const status = useAgentSession(selectStatus);
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
  /** Rendered above the thread — session tabs, model picker, status. */
  header?: ReactNode;
  renderers?: ToolRenderers;
  empty?: EmptyStateProps;
  composerPlaceholder?: string;
  className?: string;
}

/**
 * Thread over composer, inside an `AgentSessionProvider`. Kind-specific panels (a draft preview,
 * a template menu) sit beside or above this in the host; the elements stay kind-agnostic.
 */
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
