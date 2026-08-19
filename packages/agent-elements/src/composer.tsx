"use client";

import { useState } from "react";

import { Alert, Button, CloseButton, TextArea } from "@heroui/react";
import { ArrowUp, Square } from "lucide-react";

import { cn } from "@chia/ui/utils/cn.util";

import { useAgentLabels, useAgentSession } from "./provider.tsx";
import { selectCanPrompt, selectIsBusy, selectStatus } from "./store.ts";

export interface ComposerProps {
  className?: string;
  /** Overrides the placeholder while the composer accepts input. */
  placeholder?: string;
}

export const Composer = ({ className, placeholder }: ComposerProps) => {
  const labels = useAgentLabels();
  const prompt = useAgentSession((state) => state.prompt);
  const abort = useAgentSession((state) => state.abort);
  const dismissFailure = useAgentSession((state) => state.dismissFailure);
  const failure = useAgentSession((state) => state.failure);
  const canPrompt = useAgentSession(selectCanPrompt);
  const busy = useAgentSession(selectIsBusy);
  const status = useAgentSession(selectStatus);
  const [text, setText] = useState("");
  const [stopping, setStopping] = useState(false);

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

  const stop = async () => {
    setStopping(true);
    try {
      await abort();
    } catch {
      // Recorded in `failure`.
    } finally {
      setStopping(false);
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

        <div className="bg-surface border-border focus-within:border-field-border-focus flex items-end gap-2 rounded-2xl border p-2 pl-3.5 shadow-xs transition-colors">
          <TextArea
            aria-label={labels.send}
            className="max-h-44 min-h-6 flex-1 resize-none border-0 bg-transparent px-0 py-1.5 text-sm shadow-none focus:ring-0"
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
          {busy ? (
            <Button
              aria-label={labels.stop}
              isIconOnly
              isPending={stopping}
              onPress={() => void stop()}
              size="sm"
              variant="danger-soft">
              <Square className="size-3.5 fill-current" />
            </Button>
          ) : (
            <Button
              aria-label={labels.send}
              isDisabled={!canPrompt || !text.trim()}
              isIconOnly
              onPress={() => void send()}
              size="sm">
              <ArrowUp className="size-4" />
            </Button>
          )}
        </div>

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
