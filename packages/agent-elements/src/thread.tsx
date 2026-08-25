"use client";

import type { ReactNode, UIEvent, WheelEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button, ScrollShadow, Spinner, Tooltip } from "@heroui/react";
import { ArrowDown } from "lucide-react";

import type { AgentViewItem } from "@chia/agent-runtime/wire/fold";
import TextShimmer from "@chia/ui/text-shimmer";
import { cn } from "@chia/ui/utils/cn.util";

import { ApprovalCard, isApprovalItem } from "./approval-card.tsx";
import { MessageActions } from "./message-actions.tsx";
import { AgentBadge, AssistantMessage, UserMessage } from "./message.tsx";
import { Notice } from "./notice.tsx";
import { orbStateOf } from "./orb-state.ts";
import { useAgentBusy, useAgentLabels, useAgentSession } from "./provider.tsx";
import type { AgentConnection } from "./store.ts";
import { ToolCall } from "./tool-call.tsx";
import type { ToolRenderers } from "./tool-call.tsx";

type Group =
  | {
      kind: "user";
      key: string;
      messageId: string;
      text: string;
      at?: number;
    }
  | { kind: "agent"; key: string; items: AgentViewItem[] };

/** Consecutive agent-side items (text, tools, notices) share one badge, like one reply. */
const groupItems = (items: readonly AgentViewItem[]): Group[] => {
  const groups: Group[] = [];
  for (const [index, item] of items.entries()) {
    if (item.kind === "user") {
      groups.push({
        kind: "user",
        key: `u:${item.messageId}`,
        messageId: item.messageId,
        text: item.text,
        at: item.at,
      });
      continue;
    }
    const last = groups.at(-1);
    if (last?.kind === "agent") last.items.push(item);
    else groups.push({ kind: "agent", key: `a:${index}`, items: [item] });
  }
  return groups;
};

const itemKey = (item: AgentViewItem, index: number): string =>
  item.kind === "tool"
    ? `t:${item.toolCallId}`
    : item.kind === "notice"
      ? `n:${index}`
      : `m:${item.messageId}`;

const AgentItem = ({
  item,
  renderers,
}: {
  item: AgentViewItem;
  renderers?: ToolRenderers;
}) => {
  if (item.kind === "tool") {
    return isApprovalItem(item) ? (
      <ApprovalCard tool={item} />
    ) : (
      <ToolCall renderers={renderers} tool={item} />
    );
  }
  if (item.kind === "notice") return <Notice notice={item} />;
  return (
    <AssistantMessage
      actions={
        <MessageActions
          messageId={item.messageId}
          role="assistant"
          text={item.text}
        />
      }
      message={item}
    />
  );
};

/** How close to the bottom still counts as "following the conversation". */
const PIN_THRESHOLD_PX = 48;
/** Breathing room above the prompt when landing on it, so it does not sit flush with the edge. */
const LATEST_PROMPT_OFFSET_PX = 24;

const isAtBottom = (element: HTMLElement) =>
  element.scrollHeight - element.scrollTop - element.clientHeight <
  PIN_THRESHOLD_PX;

/**
 * Where "latest" is: the tail while a turn is running, otherwise the operator's last prompt,
 * aligned to the top so the prompt and the start of its reply are both in view.
 */
const scrollToLatest = (element: HTMLElement, busy: boolean) => {
  if (busy) {
    element.scrollTop = element.scrollHeight;
    return;
  }
  const prompts = element.querySelectorAll<HTMLElement>('[data-role="user"]');
  const prompt = prompts.item(prompts.length - 1);
  // Set scrollTop by hand: `scrollIntoView` would also scroll every ancestor, the window included.
  element.scrollTop = prompt
    ? prompt.getBoundingClientRect().top -
      element.getBoundingClientRect().top +
      element.scrollTop -
      LATEST_PROMPT_OFFSET_PX
    : element.scrollHeight;
};

interface ThreadViewportProps {
  busy: boolean;
  children: ReactNode;
  className?: string;
  connection: AgentConnection;
  hasContent: boolean;
  jumpLabel: string;
  pendingPrompt: string | null;
}

/** Owns transient scroll state so scrolling never rerenders the transcript. */
const ThreadViewport = ({
  busy,
  children,
  className,
  connection,
  hasContent,
  jumpLabel,
  pendingPrompt,
}: ThreadViewportProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const followingRef = useRef(true);
  const lastScrollTopRef = useRef(0);
  const previousTransitionRef = useRef({ connection, pendingPrompt });
  const [following, setFollowing] = useState(true);

  const syncFollowing = useCallback((next: boolean) => {
    if (followingRef.current === next) return;
    followingRef.current = next;
    setFollowing(next);
  }, []);

  const scroll = useCallback(
    (target: "bottom" | "latest") => {
      const element = scrollRef.current;
      if (!element) return;
      if (target === "bottom") element.scrollTop = element.scrollHeight;
      else scrollToLatest(element, busy);
      lastScrollTopRef.current = element.scrollTop;
      syncFollowing(isAtBottom(element));
    },
    [busy, syncFollowing]
  );

  // Follow actual layout growth rather than scheduling a scroll for every streamed text chunk.
  useEffect(() => {
    const element = scrollRef.current;
    const content = contentRef.current;
    if (!element || !content) return;
    const observer = new ResizeObserver(() => {
      if (!followingRef.current) return;
      element.scrollTop = element.scrollHeight;
      lastScrollTopRef.current = element.scrollTop;
    });
    observer.observe(element);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  // Prompt submission and hydration are the only transitions that deliberately reposition the view.
  useEffect(() => {
    const previous = previousTransitionRef.current;
    const sent = pendingPrompt !== null && previous.pendingPrompt === null;
    const hydrated =
      previous.connection === "hydrating" && connection !== "hydrating";
    previousTransitionRef.current = { connection, pendingPrompt };
    if (sent) scroll("bottom");
    else if (hydrated) scroll("latest");
  }, [connection, pendingPrompt, scroll]);

  const onScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      const element = event.currentTarget;
      const scrollingUp = element.scrollTop < lastScrollTopRef.current;
      lastScrollTopRef.current = element.scrollTop;
      syncFollowing(!scrollingUp && isAtBottom(element));
    },
    [syncFollowing]
  );

  const onWheelCapture = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      if (event.deltaY < 0) syncFollowing(false);
    },
    [syncFollowing]
  );

  const stopFollowing = useCallback(
    () => syncFollowing(false),
    [syncFollowing]
  );

  return (
    <div className={cn("relative flex min-h-0 flex-1 flex-col", className)}>
      <ScrollShadow
        ref={scrollRef}
        className="min-h-0 flex-1 px-4 py-6"
        onScroll={onScroll}
        onTouchMoveCapture={stopFollowing}
        onWheelCapture={onWheelCapture}
        size={48}>
        <div ref={contentRef}>{children}</div>
      </ScrollShadow>
      {!following && hasContent ? (
        // Positioned by a wrapper so the tooltip anchors to the button's real box.
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
          <Tooltip delay={300}>
            <Tooltip.Trigger>
              <Button
                isIconOnly
                aria-label={jumpLabel}
                className="rounded-full shadow-md"
                size="sm"
                variant="secondary"
                onPress={() => scroll("latest")}>
                <ArrowDown aria-hidden className="size-4" />
              </Button>
            </Tooltip.Trigger>
            <Tooltip.Content placement="top">{jumpLabel}</Tooltip.Content>
          </Tooltip>
        </div>
      ) : null}
    </div>
  );
};

export interface ThreadProps {
  renderers?: ToolRenderers;
  /** Shown instead of the transcript while it is empty. */
  empty?: ReactNode;
  className?: string;
}

export const Thread = ({ className, empty, renderers }: ThreadProps) => {
  const items = useAgentSession((state) => state.view.items);
  const pendingPrompt = useAgentSession((state) => state.pendingPrompt);
  const connection = useAgentSession((state) => state.connection);
  const labels = useAgentLabels();
  const busy = useAgentBusy();

  const groups = useMemo(() => groupItems(items), [items]);

  const showEmpty = items.length === 0 && !pendingPrompt;
  const last = items.at(-1);
  const tailActive =
    last?.kind === "assistant"
      ? last.streaming
      : last?.kind === "tool" && last.status === "running";
  // Something is happening server-side that no item shows yet (before the first event, between tools).
  const working = connection === "streaming" && !tailActive;

  const jumpLabel = busy ? labels.scrollToBottom : labels.scrollToLatestPrompt;

  return (
    <ThreadViewport
      busy={busy}
      className={className}
      connection={connection}
      hasContent={!showEmpty}
      jumpLabel={jumpLabel}
      pendingPrompt={pendingPrompt}>
      {connection === "hydrating" && items.length === 0 ? (
        <div className="flex min-h-40 items-center justify-center">
          <Spinner size="sm" />
        </div>
      ) : showEmpty ? (
        empty
      ) : (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          {groups.map((group) => {
            if (group.kind === "user") {
              return (
                <UserMessage
                  key={group.key}
                  actions={
                    <MessageActions
                      messageId={group.messageId}
                      role="user"
                      text={group.text}
                    />
                  }
                  at={group.at}
                  text={group.text}
                />
              );
            }
            const live = orbStateOf(group.items);
            return (
              <div key={group.key} className="flex gap-3">
                <AgentBadge
                  className="mt-0.5"
                  state={live ?? "composing"}
                  paused={live === null}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  {group.items.map((item, index) => (
                    <AgentItem
                      key={itemKey(item, index)}
                      item={item}
                      renderers={renderers}
                    />
                  ))}
                </div>
              </div>
            );
          })}
          {pendingPrompt ? <UserMessage text={pendingPrompt} /> : null}
          {working ? (
            <div className="flex gap-3">
              <AgentBadge className="mt-0.5" state="composing" />
              <TextShimmer
                as="span"
                active
                className="text-xs leading-6"
                duration={2.5}>
                {labels.thinking}
              </TextShimmer>
            </div>
          ) : null}
        </div>
      )}
    </ThreadViewport>
  );
};
