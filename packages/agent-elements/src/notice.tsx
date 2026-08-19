"use client";

import { Alert } from "@heroui/react";
import { Archive, CircleAlert, ShieldCheck } from "lucide-react";

import type { NoticeView } from "@chia/agent-runtime/wire/fold";
import { cn } from "@chia/ui/utils/cn.util";

import { useAgentLabels } from "./provider.tsx";

export interface NoticeProps {
  notice: NoticeView;
  className?: string;
}

/**
 * Compaction, relayed approval decisions and agent-side errors, inline where they happened in the
 * transcript.
 */
export const Notice = ({ className, notice }: NoticeProps) => {
  const labels = useAgentLabels();

  if (notice.variant === "decision") {
    return (
      <div
        className={cn("text-muted flex items-center gap-2 text-xs", className)}>
        <ShieldCheck className="size-3.5" />
        <span className="font-medium">{labels.decisionRelayed}</span>
        <span className="truncate">{notice.text}</span>
      </div>
    );
  }

  if (notice.variant === "compacted") {
    return (
      <div
        className={cn("text-muted flex items-center gap-2 text-xs", className)}>
        <Archive className="size-3.5" />
        <span className="font-medium">{labels.compacted}</span>
        <span className="truncate">{notice.text}</span>
      </div>
    );
  }

  return (
    <Alert className={className} status="danger">
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
