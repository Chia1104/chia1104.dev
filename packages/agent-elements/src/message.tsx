"use client";

import { Disclosure } from "@heroui/react";
import { Sparkles } from "lucide-react";

import type { TextMessageView } from "@chia/agent-runtime/wire/fold";
import { cn } from "@chia/ui/utils/cn.util";

import { useAgentLabels } from "./provider.tsx";

export const UserMessage = ({
  className,
  text,
}: {
  text: string;
  className?: string;
}) => (
  <div className={cn("flex justify-end", className)}>
    <div className="bg-surface-secondary text-foreground max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-6 whitespace-pre-wrap">
      {text}
    </div>
  </div>
);

/** Blinking insertion point shown at the end of text still being streamed. */
export const StreamingCaret = () => (
  <span
    aria-hidden="true"
    className="bg-accent ml-0.5 inline-block h-[1em] w-0.5 animate-pulse align-[-0.15em]"
  />
);

export const AgentBadge = ({ className }: { className?: string }) => (
  <span
    className={cn(
      "bg-accent-soft text-accent-soft-foreground flex size-7 shrink-0 items-center justify-center rounded-full",
      className
    )}>
    <Sparkles className="size-3.5" />
  </span>
);

const ThinkingBlock = ({
  streaming,
  text,
}: {
  text: string;
  streaming: boolean;
}) => {
  const labels = useAgentLabels();
  return (
    <Disclosure
      className="bg-surface border-border rounded-xl border"
      defaultExpanded={streaming}>
      <Disclosure.Heading>
        <Disclosure.Trigger className="text-muted h-9 w-full justify-start gap-2 px-3 text-xs">
          <span
            className={cn(
              "size-1.5 rounded-full",
              streaming ? "bg-accent animate-pulse" : "bg-muted"
            )}
          />
          {streaming ? labels.thinking : labels.thought}
          <Disclosure.Indicator className="ml-auto" />
        </Disclosure.Trigger>
      </Disclosure.Heading>
      <Disclosure.Content>
        <Disclosure.Body className="text-muted px-3 pb-3 text-xs leading-relaxed whitespace-pre-wrap">
          {text}
        </Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  );
};

/**
 * Thinking is shown open while it streams and collapsed once text starts — the model's own text
 * is the answer, the thinking is context.
 */
export const AssistantMessage = ({
  className,
  message,
}: {
  message: TextMessageView;
  className?: string;
}) => {
  const thinkingStreaming = message.streaming && !message.text;
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {message.thinking ? (
        <ThinkingBlock
          key={thinkingStreaming ? "live" : "done"}
          streaming={thinkingStreaming}
          text={message.thinking}
        />
      ) : null}
      {message.text || !message.thinking ? (
        <p className="text-foreground text-[15px] leading-7 whitespace-pre-wrap">
          {message.text}
          {message.streaming ? <StreamingCaret /> : null}
        </p>
      ) : null}
    </div>
  );
};
