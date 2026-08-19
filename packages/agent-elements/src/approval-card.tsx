"use client";

import { useState } from "react";

import { Button, Chip } from "@heroui/react";
import { Check, ShieldAlert, X } from "lucide-react";

import type { ToolCallView } from "@chia/agent-runtime/wire/fold";
import { cn } from "@chia/ui/utils/cn.util";

import { useAgentLabels, useAgentSession } from "./provider.tsx";
import { jsonOf } from "./tool-call.tsx";

/** A tool item is rendered as an approval once a decision was asked of the operator. */
export const isApprovalItem = (tool: ToolCallView): boolean =>
  tool.status === "awaiting_approval" || tool.approval !== undefined;

export interface ApprovalCardProps {
  tool: ToolCallView;
  className?: string;
}

/**
 * The approval handshake, in place in the transcript. Deciding starts the follow-up turn through
 * the store, so both buttons lock the moment one is pressed.
 */
export const ApprovalCard = ({ className, tool }: ApprovalCardProps) => {
  const labels = useAgentLabels();
  const approve = useAgentSession((state) => state.approve);
  const streaming = useAgentSession(
    (state) => state.connection === "streaming"
  );
  const [deciding, setDeciding] = useState<boolean | null>(null);

  const decide = async (approved: boolean) => {
    setDeciding(approved);
    try {
      await approve(tool.toolCallId, approved);
    } catch {
      // The store recorded the failure; the card stays actionable.
    } finally {
      setDeciding(null);
    }
  };

  const pending = tool.approval === undefined;
  const args = jsonOf(tool.args);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border p-4",
        pending
          ? "border-warning/40 bg-surface"
          : "border-border bg-surface-secondary/60",
        className
      )}>
      <div className="flex flex-col gap-1">
        <span className="text-warning flex items-center gap-1.5 font-mono text-[11px] tracking-wide">
          <ShieldAlert className="size-3" />
          {labels.approvalTag} · {tool.toolName}
        </span>
        <h4 className="text-foreground text-sm font-semibold">
          {labels.approvalTitle(tool.label)}
        </h4>
      </div>

      {args ? (
        <pre className="bg-surface-secondary text-foreground max-h-56 overflow-auto rounded-lg p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
          {args}
        </pre>
      ) : null}

      {pending ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            isDisabled={streaming || deciding !== null}
            isPending={deciding === true}
            onPress={() => void decide(true)}
            size="sm">
            <Check className="size-4" />
            {labels.approve}
          </Button>
          <Button
            isDisabled={streaming || deciding !== null}
            isPending={deciding === false}
            onPress={() => void decide(false)}
            size="sm"
            variant="secondary">
            <X className="size-4" />
            {labels.reject}
          </Button>
          <span className="text-muted ml-auto text-xs">
            {labels.approvalHint}
          </span>
        </div>
      ) : (
        <div className="text-muted flex items-center gap-2 text-xs">
          <Chip
            color={tool.approval?.approved ? "success" : "default"}
            size="sm"
            variant="soft">
            <Chip.Label>
              {tool.approval?.approved ? labels.approved : labels.rejected}
            </Chip.Label>
          </Chip>
          <span>
            {tool.approval?.approved
              ? labels.approvedNote
              : labels.rejectedNote}
          </span>
          {tool.approval?.comment ? (
            <span className="text-foreground">— {tool.approval.comment}</span>
          ) : null}
        </div>
      )}
    </div>
  );
};
