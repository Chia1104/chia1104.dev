"use client";

import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

import { Disclosure } from "@heroui/react";
import { Check } from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";

import type { TextMessageView } from "@chia/agent-runtime/wire/fold";
import { CopyButton } from "@chia/ui/copy-button";
import TextShimmer from "@chia/ui/text-shimmer";
import { cn } from "@chia/ui/utils/cn.util";

import { Expandable } from "./expandable.tsx";
import { useAgentLabels } from "./labels-context.tsx";
import { Markdown } from "./markdown.tsx";
import type { OrbState } from "./orb-state.ts";
import { formatMessageTime, formatMessageTimeFull } from "./time.ts";

/** Ten lines of the bubble's `leading-6`. */
const USER_MESSAGE_MAX_HEIGHT = 240;

// Nothing to subscribe to: mounted-ness never changes after the first client render.
const subscribeNever = () => () => undefined;

/**
 * True only after hydration. Times use the browser's locale and zone, which SSR cannot know,
 * so they render client-side only. The server HTML and first client render agree.
 */
const useMounted = () =>
  useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false
  );

const MessageMeta = ({
  actions,
  align,
  at,
  text,
}: {
  at?: number;
  text: string;
  align: "start" | "end";
  actions?: ReactNode;
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
      {text || actions ? (
        <span className="flex items-center gap-0.5 transition-opacity group-hover:opacity-100 focus-within:opacity-100 md:opacity-0">
          {text ? (
            <CopyButton
              aria-label={labels.copy}
              className="size-6 min-w-6"
              content={text}
              translations={{ copy: labels.copy, copied: labels.copied }}
              variant="ghost"
            />
          ) : null}
          {actions}
        </span>
      ) : null}
    </div>
  );
};

export const UserMessage = ({
  actions,
  at,
  attachments,
  className,
  text,
}: {
  text: string;
  at?: number;
  /** What the operator handed over with the message; the agent read them ahead of the text. */
  attachments?: TextMessageView["attachments"];
  actions?: ReactNode;
  className?: string;
}) => (
  <div
    className={cn("group flex flex-col items-end gap-1", className)}
    data-role="user">
    {attachments && attachments.length > 0 ? (
      <div className="flex max-w-[85%] flex-wrap justify-end gap-1">
        {attachments.map((attachment) => (
          <span
            key={`${attachment.type}:${attachment.id}`}
            className="bg-surface-secondary text-muted border-border rounded-full border px-2 py-0.5 text-[11px]">
            {attachment.label ?? `${attachment.type} #${attachment.id}`}
          </span>
        ))}
      </div>
    ) : null}
    <Expandable
      className="bg-surface-secondary text-foreground max-w-[85%] rounded-2xl rounded-br-md px-3 py-2.5 text-sm leading-6"
      maxHeight={USER_MESSAGE_MAX_HEIGHT}
      toggleClassName="-mb-1 justify-end pt-1">
      <div className="whitespace-pre-wrap">{text}</div>
    </Expandable>
    <MessageMeta actions={actions} align="end" at={at} text={text} />
  </div>
);

/** `state` is what the agent is doing now; `null` is the resting avatar of a finished reply. */
export const AgentBadge = ({
  className,
  state,
}: {
  className?: string;
  state: OrbState | null;
}) => {
  if (state) {
    return (
      <ThinkingOrb
        aria-hidden
        state={state}
        size={20}
        className={cn("size-5 shrink-0", className)}
      />
    );
  }
  return (
    <span
      className={cn(
        "text-muted grid size-5 shrink-0 place-items-center",
        className
      )}
    />
  );
};

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
        <Disclosure.Trigger className="text-muted flex h-8 w-full items-center justify-start gap-2 px-3 text-xs">
          <span className="grid size-4 shrink-0 place-items-center">
            {streaming ? (
              <ThinkingOrb
                aria-hidden
                state="solving"
                size={20}
                className="size-4"
              />
            ) : (
              <Check aria-hidden className="text-success size-3.5" />
            )}
          </span>
          <TextShimmer as="span" active={streaming} duration={2.5}>
            {streaming ? labels.thinking : labels.thought}
          </TextShimmer>
          <Disclosure.Indicator className="ml-auto size-3.5 " />
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

export const AssistantThinking = ({
  message,
}: {
  message: TextMessageView;
}) => {
  if (!message.thinking) return null;
  const streaming = message.streaming && !message.text;
  return (
    <ThinkingBlock
      key={streaming ? "live" : "done"}
      streaming={streaming}
      text={message.thinking}
    />
  );
};

/** Thinking stays open while it streams and collapses once text starts. */
export const AssistantMessage = ({
  actions,
  className,
  message,
  showThinking = true,
}: {
  message: TextMessageView;
  actions?: ReactNode;
  className?: string;
  showThinking?: boolean;
}) => {
  return (
    <div className={cn("group flex flex-col gap-3", className)}>
      {showThinking ? <AssistantThinking message={message} /> : null}
      {message.text || !message.thinking ? (
        <Markdown streaming={message.streaming} text={message.text} />
      ) : null}
      {!message.streaming && message.text ? (
        <MessageMeta
          actions={actions}
          align="start"
          at={message.at}
          text={message.text}
        />
      ) : null}
    </div>
  );
};
