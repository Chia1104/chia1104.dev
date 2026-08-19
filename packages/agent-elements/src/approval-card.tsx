"use client";

import { useState } from "react";

import { Button, Checkbox, Chip, Label, TextArea } from "@heroui/react";
import { Check, MessageSquareText, ShieldAlert, X } from "lucide-react";

import type { ToolCallView } from "@chia/agent-runtime/wire/fold";
import { cn } from "@chia/ui/utils/cn.util";

import { fill } from "./labels.ts";
import {
  useAgentLabels,
  useAgentSession,
  useSessionDetail,
  useUpdateSettings,
} from "./provider.tsx";
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
 * the store, so both buttons lock the moment one is pressed. A note travels with the decision as
 * its comment; "always allow" adds the tool's tier to the session's auto-approve list first, so
 * the same tier never asks again this session.
 */
export const ApprovalCard = ({ className, tool }: ApprovalCardProps) => {
  const labels = useAgentLabels();
  const approve = useAgentSession((state) => state.approve);
  const updateSettings = useUpdateSettings();
  const autoApprove = useSessionDetail().data?.settings?.autoApprove;
  const streaming = useAgentSession(
    (state) => state.connection === "streaming"
  );
  const [deciding, setDeciding] = useState<boolean | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [always, setAlways] = useState(false);

  const canOfferAlways =
    tool.tier !== "" && !(autoApprove ?? []).includes(tool.tier);

  const decide = async (approved: boolean) => {
    setDeciding(approved);
    try {
      if (approved && always && canOfferAlways) {
        await updateSettings.mutateAsync({
          autoApprove: [...(autoApprove ?? []), tool.tier],
        });
      }
      await approve(tool.toolCallId, approved, note.trim() || undefined);
    } catch {
      // The store recorded the failure; the card stays actionable.
    } finally {
      setDeciding(null);
    }
  };

  const pending = tool.approval === undefined;
  const locked = streaming || deciding !== null;
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
          {fill(labels.approvalTitle, { tool: tool.label })}
        </h4>
      </div>

      {args ? (
        <pre className="bg-surface-secondary text-foreground max-h-56 overflow-auto rounded-lg p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
          {args}
        </pre>
      ) : null}

      {pending ? (
        <>
          {noteOpen ? (
            <TextArea
              aria-label={labels.addNote}
              className="text-sm"
              disabled={locked}
              onChange={(event) => setNote(event.target.value)}
              placeholder={labels.notePlaceholder}
              rows={2}
              value={note}
              variant="secondary"
            />
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              isDisabled={locked}
              isPending={deciding === true}
              onPress={() => void decide(true)}
              size="sm">
              <Check className="size-4" />
              {labels.approve}
            </Button>
            <Button
              isDisabled={locked}
              isPending={deciding === false}
              onPress={() => void decide(false)}
              size="sm"
              variant="secondary">
              <X className="size-4" />
              {labels.reject}
            </Button>
            {!noteOpen ? (
              <Button
                className="text-muted"
                isDisabled={locked}
                onPress={() => setNoteOpen(true)}
                size="sm"
                variant="ghost">
                <MessageSquareText className="size-3.5" />
                {labels.addNote}
              </Button>
            ) : null}
            <span className="text-muted ml-auto text-xs">
              {labels.approvalHint}
            </span>
          </div>
          {canOfferAlways ? (
            <Checkbox
              isDisabled={locked}
              isSelected={always}
              onChange={setAlways}>
              <Checkbox.Content>
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <Label className="text-muted text-xs">
                  {fill(labels.alwaysAllow, { tier: tool.tier })}
                </Label>
              </Checkbox.Content>
            </Checkbox>
          ) : null}
        </>
      ) : (
        <div className="text-muted flex flex-wrap items-center gap-2 text-xs">
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
