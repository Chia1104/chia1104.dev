"use client";

import type { ReactNode } from "react";
import { useLayoutEffect, useRef, useState } from "react";

import { Alert, Button, CloseButton, TextArea } from "@heroui/react";
import { BorderBeam } from "border-beam";
import { ArrowUp, Square, X } from "lucide-react";

import { cn } from "@chia/ui/utils/cn.util";

import { ModelPicker } from "./model-picker.tsx";
import {
  useAbortSession,
  useAgentBusy,
  useAgentLabels,
  useAgentSession,
  useAgentStatus,
  useCanPrompt,
} from "./provider.tsx";

/** Tallest the input grows before it scrolls, in px — about eight lines. */
const MAX_INPUT_HEIGHT = 200;

export interface ComposerProps {
  className?: string;
  /** Overrides the placeholder while the composer accepts input. */
  placeholder?: string;
  /**
   * Controls on the toolbar's left, beside the send button. Defaults to the model picker; pass
   * `null` for none.
   */
  toolbar?: ReactNode;
  /**
   * Stacked above the input and tucked under its top edge: the context the next prompt acts on
   * (drafts, attachments, pending items). Compose from `ComposerAttachment` rows.
   */
  attachments?: ReactNode;
}

export interface ComposerAttachmentProps {
  icon: ReactNode;
  label: ReactNode;
  /** Trailing detail beside the label, e.g. a locale or status chip. */
  meta?: ReactNode;
  /** An explicit control at the row's end; separate from the row press so the two never compete. */
  action?: ReactNode;
  /** Makes the whole row a button. */
  onPress?: () => void;
  /** Adds a trailing dismiss button. */
  onDismiss?: () => void;
  className?: string;
}

/** One row in the composer's attachment stack. */
export const ComposerAttachment = ({
  action,
  className,
  icon,
  label,
  meta,
  onDismiss,
  onPress,
}: ComposerAttachmentProps) => {
  const labels = useAgentLabels();
  const body = (
    <>
      <span className="text-muted flex size-4 shrink-0 items-center justify-center [&>svg]:size-3">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-left text-xs">{label}</span>
      {meta}
    </>
  );

  return (
    <div
      className={cn(
        "text-foreground flex min-h-8 items-center gap-2 px-2 py-1",
        className
      )}>
      {onPress ? (
        <button
          className="hover:text-foreground text-foreground/80 flex min-w-0 flex-1 cursor-pointer items-center gap-2 transition-colors focus-visible:outline-none"
          onClick={onPress}
          type="button">
          {body}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2">{body}</div>
      )}
      {action}
      {onDismiss ? (
        <Button
          aria-label={labels.dismiss}
          isIconOnly
          onPress={onDismiss}
          size="sm"
          variant="ghost">
          <X className="size-3.5" />
        </Button>
      ) : null}
    </div>
  );
};

/**
 * The input on top, a toolbar below: model picker (or whatever the host puts there) on the left,
 * send/stop on the right. The input grows with its content up to a cap, then scrolls.
 */
export const Composer = ({
  attachments,
  className,
  placeholder,
  toolbar = <ModelPicker />,
}: ComposerProps) => {
  const labels = useAgentLabels();
  const prompt = useAgentSession((state) => state.prompt);
  const dismissFailure = useAgentSession((state) => state.dismissFailure);
  const failure = useAgentSession((state) => state.failure);
  const abort = useAbortSession();
  const canPrompt = useCanPrompt();
  const busy = useAgentBusy();
  const status = useAgentStatus();
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Grow with the content: measure the natural height, cap it, and let the rest scroll.
  useLayoutEffect(() => {
    const element = inputRef.current;
    if (!element) return;
    element.style.height = "0px";
    const next = Math.min(element.scrollHeight, MAX_INPUT_HEIGHT);
    element.style.height = `${next}px`;
    element.style.overflowY =
      element.scrollHeight > MAX_INPUT_HEIGHT ? "auto" : "hidden";
  }, [text]);

  const send = async () => {
    const value = text.trim();
    if (!value || !canPrompt) return;
    setText("");
    try {
      await prompt(value);
    } catch {
      // The request never left: give the operator their text back to retry.
      setText(value);
    }
  };

  const composerPlaceholder =
    status === "awaiting_approval"
      ? labels.composerPlaceholderApproval
      : busy
        ? labels.composerPlaceholderRunning
        : (placeholder ?? labels.composerPlaceholder);

  return (
    <div className={cn("shrink-0 px-4 pt-2 pb-4", className)}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
        {failure ? (
          <Alert status="danger">
            <Alert.Content>
              <Alert.Description className="break-words">
                {failure}
              </Alert.Description>
            </Alert.Content>
            <CloseButton aria-label={labels.dismiss} onPress={dismissFailure} />
          </Alert>
        ) : null}

        {attachments ? (
          <div className="bg-surface-secondary border-border divide-border -mb-5 max-h-40 w-full max-w-[95%] divide-y self-center overflow-y-auto rounded-t-2xl border border-b-0 pb-3">
            {attachments}
          </div>
        ) : null}

        <BorderBeam
          className="relative z-10"
          duration={3.5}
          size="pulse-inner"
          theme="light"
          strength={100}>
          <div className="bg-surface border-border focus-within:border-field-border-focus flex flex-col gap-1 rounded-2xl border px-3 pt-3 pb-2 shadow-xs transition-colors">
            <TextArea
              ref={inputRef}
              aria-label={labels.send}
              className="min-h-10 w-full resize-none rounded-none border-0 bg-transparent p-0 text-sm leading-6 shadow-none focus:ring-0"
              disabled={!canPrompt}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key !== "Enter" ||
                  event.shiftKey ||
                  event.nativeEvent.isComposing
                ) {
                  return;
                }
                event.preventDefault();
                void send();
              }}
              placeholder={composerPlaceholder}
              rows={1}
              value={text}
              variant="secondary"
            />
            <div className="z-20 flex items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-1">
                {toolbar}
              </div>
              {busy ? (
                <Button
                  aria-label={labels.stop}
                  isIconOnly
                  isPending={abort.isPending}
                  onPress={() => abort.mutate()}
                  size="sm"
                  variant="danger-soft">
                  <Square className="size-3.5 fill-current" />
                </Button>
              ) : (
                <Button
                  aria-label={labels.send}
                  className="rounded-full"
                  isDisabled={!canPrompt || !text.trim()}
                  isIconOnly
                  onPress={() => void send()}
                  size="sm">
                  <ArrowUp className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </BorderBeam>

        <div className="text-muted flex justify-between px-1 text-[11px]">
          <span>{labels.composerHint}</span>
          <span>
            {status === "running"
              ? labels.statusStreaming
              : status === "awaiting_approval"
                ? labels.statusAwaitingApproval
                : labels.statusReady}
          </span>
        </div>
      </div>
    </div>
  );
};
