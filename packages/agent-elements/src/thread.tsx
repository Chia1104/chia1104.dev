"use client";

import type { ReactNode, UIEvent, WheelEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  Button,
  Disclosure,
  ScrollShadow,
  Spinner,
  Tooltip,
} from "@heroui/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import type {
  AgentViewItem,
  NoticeView,
  TextMessageView,
  ToolCallView,
} from "@chia/agent-runtime/wire/fold";
import TextShimmer from "@chia/ui/text-shimmer";
import { cn } from "@chia/ui/utils/cn.util";

import { ApprovalCard } from "./approval-card.tsx";
import { useAgentLabels } from "./labels-context.tsx";
import { MessageActions } from "./message-actions.tsx";
import {
  AgentBadge,
  AssistantMessage,
  AssistantThinking,
  UserMessage,
} from "./message.tsx";
import { Notice } from "./notice.tsx";
import { orbStateOf } from "./orb-state.ts";
import type { OrbState } from "./orb-state.ts";
import { useAgentBusy, useAgentSession } from "./provider.tsx";
import type { AgentConnection } from "./store.ts";
import { ToolCall } from "./tool-call.tsx";
import type { ToolRenderers } from "./tool-call.tsx";

type RowGap = "group" | "none";
type AssistantItemView = TextMessageView & { kind: "assistant" };
type AgentItemView = AssistantItemView | NoticeView | ToolCallView;
type ActivityItemView = AssistantItemView | ToolCallView;
type OutputItemView = AssistantItemView | NoticeView;

type AgentSegment =
  | { kind: "activity"; key: string; items: ActivityItemView[] }
  | { kind: "output"; key: string; item: OutputItemView };

type ThreadRow =
  | {
      kind: "user";
      key: string;
      messageId: string;
      text: string;
      attachments?: TextMessageView["attachments"];
      gapAfter: RowGap;
      at?: number;
    }
  | {
      kind: "agent";
      key: string;
      items: AgentItemView[];
      segments: AgentSegment[];
      gapAfter: RowGap;
      badgeState: OrbState | null;
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

/**
 * Splits a reply into arrival-ordered segments: consecutive thinking and tool calls share one
 * collapsible segment, and each text or notice sits between them. A message's thinking precedes
 * its text because the fold keeps the two channels as separate strings.
 */
const segmentsOf = (
  items: readonly AgentItemView[],
  offset: number
): AgentSegment[] => {
  const segments: AgentSegment[] = [];
  let activity: Extract<AgentSegment, { kind: "activity" }> | null = null;

  items.forEach((item, index) => {
    const key = itemKey(item, offset + index);
    if (item.kind === "tool" || (item.kind === "assistant" && item.thinking)) {
      if (!activity) {
        activity = { kind: "activity", key: `a:${key}`, items: [] };
        segments.push(activity);
      }
      activity.items.push(item);
    }
    if (item.kind === "notice" || (item.kind === "assistant" && item.text)) {
      activity = null;
      segments.push({ kind: "output", key: `o:${key}`, item });
    }
  });

  return segments;
};

/** Consecutive agent-side items form one collapsible, virtualized reply. */
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
        attachments: item.attachments,
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

    rows.push({
      kind: "agent",
      key: `a:${groupStart}`,
      items: group,
      segments: segmentsOf(group, groupStart),
      gapAfter: "group",
      badgeState,
    });
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

const ToolItem = ({
  item,
  renderers,
}: {
  item: ToolCallView;
  renderers?: ToolRenderers;
}) =>
  item.approval ? (
    <ApprovalCard tool={item} />
  ) : (
    <ToolCall renderers={renderers} tool={item} />
  );

const AgentOutputItem = ({ item }: { item: OutputItemView }) => {
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
      showThinking={false}
    />
  );
};

const ActivityStatusLabel = ({
  active,
  label,
}: {
  active: boolean;
  label: string;
}) => {
  const reduceMotion = useReducedMotion();
  const offset = reduceMotion ? 0 : 12;

  return (
    <span className="grid h-5 overflow-hidden leading-5">
      <AnimatePresence initial={false}>
        <motion.span
          key={label}
          animate={{ opacity: 1, y: 0 }}
          className="col-start-1 row-start-1"
          exit={{ opacity: 0, y: -offset }}
          initial={{ opacity: 0, y: offset }}
          transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}>
          <TextShimmer as="span" active={active} duration={2.5}>
            {label}
          </TextShimmer>
        </motion.span>
      </AnimatePresence>
    </span>
  );
};

const ActivitySegment = ({
  live,
  renderers,
  segment,
  thinkingLabel,
  thoughtLabel,
}: {
  live: boolean;
  renderers?: ToolRenderers;
  segment: Extract<AgentSegment, { kind: "activity" }>;
  thinkingLabel: string;
  thoughtLabel: string;
}) => {
  const activeTool = live
    ? segment.items.findLast(
        (item): item is ToolCallView =>
          item.kind === "tool" &&
          (item.status === "running" || item.status === "awaiting_approval")
      )
    : undefined;
  const label = live ? (activeTool?.label ?? thinkingLabel) : thoughtLabel;

  return (
    <Disclosure>
      <Disclosure.Heading>
        <Disclosure.Trigger className="text-muted flex h-8 w-full items-center gap-2 text-xs">
          <ActivityStatusLabel active={live} label={label} />
          <Disclosure.Indicator className="ml-auto size-3.5" />
        </Disclosure.Trigger>
      </Disclosure.Heading>
      <Disclosure.Content>
        <Disclosure.Body className="flex min-w-0 flex-col gap-3">
          {segment.items.map((item) =>
            item.kind === "tool" ? (
              <ToolItem
                key={item.toolCallId}
                item={item}
                renderers={renderers}
              />
            ) : (
              <AssistantThinking key={item.messageId} message={item} />
            )
          )}
        </Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  );
};

const ThreadRowContent = ({
  renderers,
  row,
  thinkingLabel,
  thoughtLabel,
}: {
  renderers?: ToolRenderers;
  row: ThreadRow;
  thinkingLabel: string;
  thoughtLabel: string;
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
        attachments={row.attachments}
        text={row.text}
      />
    );
  }
  if (row.kind === "pending") return <UserMessage text={row.text} />;
  if (row.kind === "working") {
    return (
      <div className="flex gap-3">
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
    <div className="flex min-w-0 flex-col gap-3">
      {row.segments.map((segment, index) =>
        segment.kind === "output" ? (
          <AgentOutputItem key={segment.key} item={segment.item} />
        ) : (
          <ActivitySegment
            key={segment.key}
            live={row.badgeState !== null && index === row.segments.length - 1}
            renderers={renderers}
            segment={segment}
            thinkingLabel={thinkingLabel}
            thoughtLabel={thoughtLabel}
          />
        )
      )}
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
  const gap = row.gapAfter === "group" ? GROUP_GAP_PX : 0;
  if (row.kind === "working") return 24 + gap;
  if (row.kind === "user" || row.kind === "pending") {
    return USER_ROW_SIZE_PX + gap;
  }
  return (
    32 +
    row.items.reduce((size, item, index) => {
      const itemSize =
        item.kind === "tool"
          ? TOOL_ROW_SIZE_PX
          : item.kind === "notice"
            ? NOTICE_ROW_SIZE_PX
            : ASSISTANT_ROW_SIZE_PX;
      return size + itemSize + (index === 0 ? 0 : ITEM_GAP_PX);
    }, 0) +
    gap
  );
};

const rowGapClassName = (gap: RowGap) => (gap === "group" ? "pb-6" : undefined);

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
  thoughtLabel: string;
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
  thoughtLabel,
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
                    thoughtLabel={thoughtLabel}
                  />
                </div>
              );
            })}
          </div>
        )}
      </ScrollShadow>
      {!following && hasContent ? (
        // Positioned by a wrapper so the tooltip anchors to the button's real box.
        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2">
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
  const streamingMessage =
    last?.kind === "assistant" && last.streaming && Boolean(last.text);
  const working = connection === "streaming" && !streamingMessage;

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
      thoughtLabel={labels.thought}
    />
  );
};
