"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef } from "react";

import { ScrollShadow, Spinner } from "@heroui/react";

import type { AgentViewItem } from "@chia/agent-runtime/wire/fold";
import { cn } from "@chia/ui/utils/cn.util";

import { ApprovalCard, isApprovalItem } from "./approval-card.tsx";
import { AgentBadge, AssistantMessage, UserMessage } from "./message.tsx";
import { Notice } from "./notice.tsx";
import { useAgentSession } from "./provider.tsx";
import { ToolCall } from "./tool-call.tsx";
import type { ToolRenderers } from "./tool-call.tsx";

type Group =
  | { kind: "user"; key: string; text: string }
  | { kind: "agent"; key: string; items: AgentViewItem[] };

/** Consecutive agent-side items (text, tools, notices) share one badge, like one reply. */
const groupItems = (items: readonly AgentViewItem[]): Group[] => {
  const groups: Group[] = [];
  for (const [index, item] of items.entries()) {
    if (item.kind === "user") {
      groups.push({
        kind: "user",
        key: `u:${item.messageId}`,
        text: item.text,
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
  return <AssistantMessage message={item} />;
};

/** Changes whenever the tail of the transcript grows, which is when the view should follow it. */
const tailKey = (items: readonly AgentViewItem[], pending: string | null) => {
  const last = items.at(-1);
  if (!last) return pending ? "pending" : "empty";
  if (last.kind === "tool") return `${last.toolCallId}:${last.status}`;
  if (last.kind === "notice") return `notice:${items.length}`;
  return `${last.messageId}:${last.text.length}:${last.thinking?.length ?? 0}`;
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
  const bottomRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => groupItems(items), [items]);
  const key = tailKey(items, pendingPrompt);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ block: "end" });
    });
    return () => cancelAnimationFrame(frame);
  }, [key]);

  const showEmpty = items.length === 0 && !pendingPrompt;
  const last = items.at(-1);
  const tailActive =
    last?.kind === "assistant"
      ? last.streaming
      : last?.kind === "tool" && last.status === "running";
  // Something is happening server-side that no item shows yet (before the first event, between tools).
  const working = connection === "streaming" && !tailActive;

  return (
    <ScrollShadow
      className={cn("min-h-0 flex-1 px-4 py-6", className)}
      size={48}>
      {connection === "hydrating" && items.length === 0 ? (
        <div className="flex min-h-40 items-center justify-center">
          <Spinner size="sm" />
        </div>
      ) : showEmpty ? (
        empty
      ) : (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          {groups.map((group) =>
            group.kind === "user" ? (
              <UserMessage key={group.key} text={group.text} />
            ) : (
              <div key={group.key} className="flex gap-3">
                <AgentBadge className="mt-0.5" />
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
            )
          )}
          {pendingPrompt ? <UserMessage text={pendingPrompt} /> : null}
          {working ? (
            <div className="flex gap-3">
              <AgentBadge className="mt-0.5" />
              <Spinner className="mt-1.5" size="sm" />
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>
      )}
    </ScrollShadow>
  );
};
