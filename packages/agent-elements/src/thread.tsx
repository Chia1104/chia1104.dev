"use client";

import type { ReactNode, UIEvent, WheelEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button, ScrollShadow, Spinner, Tooltip } from "@heroui/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown } from "lucide-react";

import type {
  AgentViewItem,
  NoticeView,
  TextMessageView,
  ToolCallView,
} from "@chia/agent-runtime/wire/fold";
import TextShimmer from "@chia/ui/text-shimmer";
import { cn } from "@chia/ui/utils/cn.util";

import { ApprovalCard, isApprovalItem } from "./approval-card.tsx";
import { useAgentLabels } from "./labels-context.tsx";
import { MessageActions } from "./message-actions.tsx";
import { AgentBadge, AssistantMessage, UserMessage } from "./message.tsx";
import { Notice } from "./notice.tsx";
import { orbStateOf } from "./orb-state.ts";
import type { OrbState } from "./orb-state.ts";
import { useAgentBusy, useAgentSession } from "./provider.tsx";
import type { AgentConnection } from "./store.ts";
import { ToolCall } from "./tool-call.tsx";
import type { ToolRenderers } from "./tool-call.tsx";

type RowGap = "group" | "item" | "none";
type AgentItemView =
  | (TextMessageView & { kind: "assistant" })
  | NoticeView
  | ToolCallView;

type ThreadRow =
  | {
      kind: "user";
      key: string;
      messageId: string;
      text: string;
      gapAfter: RowGap;
      at?: number;
    }
  | {
      kind: "agent";
      key: string;
      item: AgentItemView;
      gapAfter: RowGap;
      /** `undefined` marks a continuation row; `null` is a finished group's badge. */
      badgeState?: OrbState | null;
    }
  | { kind: "pending"; key: "pending"; text: string; gapAfter: RowGap }
  | { kind: "working"; key: "working"; gapAfter: RowGap };

const itemKey = (item: AgentViewItem, index: number): string =>
  item.kind === "tool"
    ? `t:${item.toolCallId}`
    : item.kind === "notice"
      ? `n:${index}`
      : `m:${item.messageId}`;

const isAgentItem = (item: AgentViewItem): item is AgentItemView =>
  item.kind !== "user";

/** Flatten logical replies so every potentially expensive item is independently virtualized. */
const buildRows = (
  items: readonly AgentViewItem[],
  pendingPrompt: string | null,
  working: boolean
): ThreadRow[] => {
  const rows: ThreadRow[] = [];
  let index = 0;

  while (index < items.length) {
    const item = items[index];
    if (!item) break;

    if (item.kind === "user") {
      rows.push({
        kind: "user",
        key: `u:${item.messageId}`,
        messageId: item.messageId,
        text: item.text,
        gapAfter: "group",
        at: item.at,
      });
      index++;
      continue;
    }

    const groupStart = index;
    const group: AgentItemView[] = [];
    while (index < items.length) {
      const groupItem = items[index];
      if (!groupItem || !isAgentItem(groupItem)) break;
      group.push(groupItem);
      index++;
    }
    const badgeState = orbStateOf(group);

    for (const [groupIndex, groupItem] of group.entries()) {
      const row: Extract<ThreadRow, { kind: "agent" }> = {
        kind: "agent",
        key: itemKey(groupItem, groupStart + groupIndex),
        item: groupItem,
        gapAfter: groupIndex === group.length - 1 ? "group" : "item",
      };
      if (groupIndex === 0) row.badgeState = badgeState;
      rows.push(row);
    }
  }

  if (pendingPrompt) {
    rows.push({
      kind: "pending",
      key: "pending",
      text: pendingPrompt,
      gapAfter: "group",
    });
  }
  if (working)
    rows.push({ kind: "working", key: "working", gapAfter: "group" });

  const last = rows.at(-1);
  if (last) last.gapAfter = "none";
  return rows;
};

const AgentItem = ({
  item,
  renderers,
}: {
  item: AgentItemView;
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

const ThreadRowContent = ({
  renderers,
  row,
  thinkingLabel,
}: {
  renderers?: ToolRenderers;
  row: ThreadRow;
  thinkingLabel: string;
}) => {
  if (row.kind === "user") {
    return (
      <UserMessage
        actions={
          <MessageActions
            messageId={row.messageId}
            role="user"
            text={row.text}
          />
        }
        at={row.at}
        text={row.text}
      />
    );
  }
  if (row.kind === "pending") return <UserMessage text={row.text} />;
  if (row.kind === "working") {
    return (
      <div className="-ml-7.5 flex gap-3">
        <AgentBadge className="mt-0.5" state="composing" />
        <TextShimmer
          as="span"
          active
          className="text-xs leading-6"
          duration={2.5}>
          {thinkingLabel}
        </TextShimmer>
      </div>
    );
  }

  return (
    <div className="-ml-7.5 flex gap-3">
      {row.badgeState === undefined ? (
        <span aria-hidden className="size-5 shrink-0" />
      ) : (
        <AgentBadge className="mt-0.5" state={row.badgeState} />
      )}
      <div className="min-w-0 flex-1">
        <AgentItem item={row.item} renderers={renderers} />
      </div>
    </div>
  );
};

/** How close to the bottom still counts as "following the conversation". */
const PIN_THRESHOLD_PX = 48;
const GROUP_GAP_PX = 24;
const ITEM_GAP_PX = 12;
const ASSISTANT_ROW_SIZE_PX = 160;
const NOTICE_ROW_SIZE_PX = 48;
const TOOL_ROW_SIZE_PX = 88;
const USER_ROW_SIZE_PX = 88;
const VIRTUAL_OVERSCAN = 5;

const isAtBottom = (element: HTMLElement) =>
  element.scrollHeight - element.scrollTop - element.clientHeight <
  PIN_THRESHOLD_PX;

const estimateRowSize = (row: ThreadRow | undefined) => {
  if (!row) return ASSISTANT_ROW_SIZE_PX;
  const gap =
    row.gapAfter === "group"
      ? GROUP_GAP_PX
      : row.gapAfter === "item"
        ? ITEM_GAP_PX
        : 0;
  if (row.kind === "working") return 24 + gap;
  if (row.kind === "user" || row.kind === "pending") {
    return USER_ROW_SIZE_PX + gap;
  }
  if (row.item.kind === "tool") return TOOL_ROW_SIZE_PX + gap;
  if (row.item.kind === "notice") return NOTICE_ROW_SIZE_PX + gap;
  return ASSISTANT_ROW_SIZE_PX + gap;
};

const rowGapClassName = (gap: RowGap) =>
  gap === "group" ? "pb-6" : gap === "item" ? "pb-3" : undefined;

const latestPromptIndex = (rows: readonly ThreadRow[]) => {
  for (let index = rows.length - 1; index >= 0; index--) {
    const row = rows[index];
    if (row?.kind === "user" || row?.kind === "pending") return index;
  }
  return -1;
};

interface ThreadViewportProps {
  busy: boolean;
  className?: string;
  connection: AgentConnection;
  fallback?: ReactNode;
  hasContent: boolean;
  jumpLabel: string;
  pendingPrompt: string | null;
  renderers?: ToolRenderers;
  rows: readonly ThreadRow[];
  thinkingLabel: string;
}

/** Owns transient scroll state so scrolling never rerenders the transcript. */
const ThreadViewport = ({
  busy,
  className,
  connection,
  fallback,
  hasContent,
  jumpLabel,
  pendingPrompt,
  renderers,
  rows,
  thinkingLabel,
}: ThreadViewportProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const followingRef = useRef(true);
  const lastScrollTopRef = useRef(0);
  const previousTransitionRef = useRef({ connection, pendingPrompt });
  const [following, setFollowing] = useState(true);

  const virtualizer = useVirtualizer({
    count: rows.length,
    directDomUpdates: true,
    directDomUpdatesMode: "position",
    estimateSize: (index) => estimateRowSize(rows[index]),
    getItemKey: (index) => rows[index]?.key ?? index,
    getScrollElement: () => scrollRef.current,
    overscan: VIRTUAL_OVERSCAN,
    useAnimationFrameWithResizeObserver: true,
    // Ref measurements can notify during React's commit, where React 19 forbids flushSync.
    useFlushSync: false,
  });
  const virtualRows = virtualizer.getVirtualItems();
  const hasRows = rows.length > 0;

  const setContentRef = useCallback(
    (element: HTMLDivElement | null) => {
      contentRef.current = element;
      virtualizer.containerRef(element);
    },
    [virtualizer]
  );

  const syncFollowing = useCallback((next: boolean) => {
    if (followingRef.current === next) return;
    followingRef.current = next;
    setFollowing(next);
  }, []);

  const scroll = useCallback(
    (target: "bottom" | "latest") => {
      const element = scrollRef.current;
      if (!element) return;
      const lastIndex = rows.length - 1;
      const promptIndex = latestPromptIndex(rows);
      if (lastIndex < 0) element.scrollTop = element.scrollHeight;
      else if (target === "bottom" || busy) {
        virtualizer.scrollToIndex(lastIndex, { align: "end" });
      } else if (promptIndex >= 0) {
        virtualizer.scrollToIndex(promptIndex, { align: "start" });
      } else virtualizer.scrollToIndex(lastIndex, { align: "end" });
      lastScrollTopRef.current = element.scrollTop;
      syncFollowing(isAtBottom(element));
    },
    [busy, rows, syncFollowing, virtualizer]
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
  }, [hasRows]);

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
        {!hasRows ? (
          fallback
        ) : (
          <div
            ref={setContentRef}
            className="relative mx-auto w-full max-w-3xl">
            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index];
              if (!row) return null;
              return (
                <div
                  key={virtualRow.key}
                  ref={virtualizer.measureElement}
                  className={cn(
                    "absolute left-0 w-full",
                    rowGapClassName(row.gapAfter)
                  )}
                  data-index={virtualRow.index}>
                  <ThreadRowContent
                    renderers={renderers}
                    row={row}
                    thinkingLabel={thinkingLabel}
                  />
                </div>
              );
            })}
          </div>
        )}
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

  const showEmpty = items.length === 0 && !pendingPrompt;
  const last = items.at(-1);
  const tailActive =
    last?.kind === "assistant"
      ? last.streaming
      : last?.kind === "tool" && last.status === "running";
  // Something is happening server-side that no item shows yet (before the first event, between tools).
  const working = connection === "streaming" && !tailActive;

  const rows = useMemo(
    () => buildRows(items, pendingPrompt, working),
    [items, pendingPrompt, working]
  );

  const jumpLabel = busy ? labels.scrollToBottom : labels.scrollToLatestPrompt;

  return (
    <ThreadViewport
      busy={busy}
      className={className}
      connection={connection}
      fallback={
        connection === "hydrating" && items.length === 0 ? (
          <div className="flex min-h-40 items-center justify-center">
            <Spinner size="sm" />
          </div>
        ) : showEmpty ? (
          empty
        ) : undefined
      }
      hasContent={!showEmpty}
      jumpLabel={jumpLabel}
      pendingPrompt={pendingPrompt}
      renderers={renderers}
      rows={rows}
      thinkingLabel={labels.thinking}
    />
  );
};
