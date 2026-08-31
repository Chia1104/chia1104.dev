"use client";

import { Alert } from "@heroui/react";
import { Archive, CircleAlert, ShieldCheck, Undo2 } from "lucide-react";

import type { NoticeView } from "@chia/agent-runtime/wire/fold";
import { cn } from "@chia/ui/utils/cn.util";

import { Expandable } from "./expandable.tsx";
import { useAgentLabels } from "./labels-context.tsx";

/** A compaction or branch summary runs to pages; the first few lines say what it is. */
const SUMMARY_MAX_HEIGHT = 160;

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
      <Alert
        className={cn("bg-surface-secondary gap-2 px-2.5 py-2", className)}>
        <Alert.Indicator>
          <CircleAlert className="size-4" />
        </Alert.Indicator>
        <Alert.Content className="min-w-0">
          <Alert.Title>{meta.label}</Alert.Title>
          <Expandable
            className="w-full min-w-0"
            maxHeight={SUMMARY_MAX_HEIGHT}
            toggleClassName="-ml-1.5 pt-1">
            <Alert.Description className="wrap-break-word whitespace-pre-wrap">
              {notice.text}
            </Alert.Description>
          </Expandable>
        </Alert.Content>
      </Alert>
    );
  }

  return (
    <Alert
      className={cn("bg-surface-secondary gap-2 px-2.5 py-2", className)}
      status="danger">
      <Alert.Indicator>
        <CircleAlert className="size-4" />
      </Alert.Indicator>
      <Alert.Content className="min-w-0">
        <Alert.Title>
          {notice.code
            ? labels.errorHeadlines[notice.code]
            : labels.errorFallback}
        </Alert.Title>
        {notice.text ? (
          <Alert.Description className="max-w-full wrap-break-word">
            {notice.text}
          </Alert.Description>
        ) : null}
      </Alert.Content>
    </Alert>
  );
};
