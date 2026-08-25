"use client";

import { Alert } from "@heroui/react";
import { Archive, CircleAlert, ShieldCheck, Undo2 } from "lucide-react";

import type { NoticeView } from "@chia/agent-runtime/wire/fold";
import { cn } from "@chia/ui/utils/cn.util";

import { useAgentLabels } from "./provider.tsx";

export interface NoticeProps {
  notice: NoticeView;
  className?: string;
}

/**
 * Compaction, rewinds, relayed approval decisions and agent-side errors, inline where they
 * happened in the transcript.
 */
export const Notice = ({ className, notice }: NoticeProps) => {
  const labels = useAgentLabels();

  if (notice.variant !== "error") {
    const meta = {
      decision: { icon: ShieldCheck, label: labels.decisionRelayed },
      compacted: { icon: Archive, label: labels.compacted },
      rewound: { icon: Undo2, label: labels.rewound },
    }[notice.variant];
    return (
      <div
        className={cn("text-muted flex items-center gap-2 text-xs", className)}>
        <meta.icon className="size-3.5" />
        <span className="font-medium">{meta.label}</span>
        <span className="truncate">{notice.text}</span>
      </div>
    );
  }

  return (
    <Alert
      className={cn("bg-surface-secondary gap-2 px-2.5 py-2", className)}
      status="danger">
      <Alert.Indicator>
        <CircleAlert className="size-4" />
      </Alert.Indicator>
      <Alert.Content>
        <Alert.Title>
          {notice.code
            ? labels.errorHeadlines[notice.code]
            : labels.errorFallback}
        </Alert.Title>
        <Alert.Description className="break-words">
          {notice.text}
        </Alert.Description>
      </Alert.Content>
    </Alert>
  );
};
