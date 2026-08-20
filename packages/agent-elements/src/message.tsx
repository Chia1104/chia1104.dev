"use client";

import { useSyncExternalStore } from "react";

import { Disclosure } from "@heroui/react";
import { ThinkingOrb } from "thinking-orbs";

import type { TextMessageView } from "@chia/agent-runtime/wire/fold";
import { CopyButton } from "@chia/ui/copy-button";
import TextShimmer from "@chia/ui/text-shimmer";
import { cn } from "@chia/ui/utils/cn.util";

import { Markdown } from "./markdown.tsx";
import type { OrbState } from "./orb-state.ts";
import { useAgentLabels } from "./provider.tsx";
import { formatMessageTime, formatMessageTimeFull } from "./time.ts";

// Nothing to subscribe to: mounted-ness never changes after the first client render.
const subscribeNever = () => () => undefined;

/**
 * True only after hydration. Times are formatted in the browser's locale and zone, which SSR
 * cannot know, so they render client-side only — the server HTML and first client render agree.
 */
const useMounted = () =>
  useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false
  );

/**
 * Time and copy under a message. Revealed on hover or keyboard focus so the thread stays quiet;
 * the time alone is always legible.
 */
const MessageMeta = ({
  align,
  at,
  text,
}: {
  at?: number;
  text: string;
  align: "start" | "end";
}) => {
  const labels = useAgentLabels();
  const mounted = useMounted();
  return (
    <div
      className={cn(
        "text-muted flex h-6 items-center gap-1 text-[11px]",
        align === "end" ? "flex-row-reverse justify-end" : "justify-start"
      )}>
      {at && mounted ? (
        <time
          className="tabular-nums"
          dateTime={new Date(at).toISOString()}
          title={formatMessageTimeFull(at)}>
          {formatMessageTime(at)}
        </time>
      ) : null}
      {text ? (
        <CopyButton
          aria-label={labels.copy}
          className="size-6 min-w-6 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          content={text}
          translations={{ copy: labels.copy, copied: labels.copied }}
          variant="ghost"
        />
      ) : null}
    </div>
  );
};

export const UserMessage = ({
  at,
  className,
  text,
}: {
  text: string;
  at?: number;
  className?: string;
}) => (
  <div
    className={cn("group flex flex-col items-end gap-1", className)}
    data-role="user">
    <div className="bg-surface-secondary text-foreground max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-6 whitespace-pre-wrap">
      {text}
    </div>
    <MessageMeta align="end" at={at} text={text} />
  </div>
);

/** `state` is what the agent is doing now; `null` is the resting avatar of a finished reply. */
export const AgentBadge = ({
  className,
  state,
  paused,
}: {
  className?: string;
  state: OrbState | null;
  paused?: boolean;
}) => (
  <ThinkingOrb
    aria-hidden
    state={state ?? "breathing"}
    size={20}
    className={cn("size-5 shrink-0", className)}
    paused={paused}
  />
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
        <Disclosure.Trigger className="text-muted flex h-9 w-full items-center justify-start gap-2 px-3 text-xs">
          <ThinkingOrb
            aria-hidden
            state="solving"
            size={20}
            className="size-4 shrink-0"
            paused={!streaming}
          />
          <TextShimmer as="span" active={streaming} duration={2.5}>
            {streaming ? labels.thinking : labels.thought}
          </TextShimmer>
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
 * is the answer, the thinking is context. Time and copy appear once the message is complete.
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
    <div className={cn("group flex flex-col gap-3", className)}>
      {message.thinking ? (
        <ThinkingBlock
          key={thinkingStreaming ? "live" : "done"}
          streaming={thinkingStreaming}
          text={message.thinking}
        />
      ) : null}
      {message.text || !message.thinking ? (
        <Markdown streaming={message.streaming} text={message.text} />
      ) : null}
      {!message.streaming && message.text ? (
        <MessageMeta align="start" at={message.at} text={message.text} />
      ) : null}
    </div>
  );
};
