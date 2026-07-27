"use client";

import { useEffect, useMemo, useRef } from "react";

import { Card, Chip, ScrollShadow, Spinner } from "@heroui/react";
import {
  Bot,
  Check,
  CircleAlert,
  CircleX,
  LoaderCircle,
  User,
  Wrench,
} from "lucide-react";

import type { AgentViewItem, AgentViewState } from "@chia/agent-core";
import { cn } from "@chia/ui/utils/cn.util";

interface AgentTranscriptProps {
  items: AgentViewItem[];
  runStatus: AgentViewState["runStatus"];
}

const jsonOf = (value: unknown) => {
  if (value === undefined) return null;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const statusMeta = {
  awaiting_approval: {
    color: "warning",
    icon: CircleAlert,
    label: "Needs approval",
  },
  error: { color: "danger", icon: CircleX, label: "Failed" },
  ok: { color: "success", icon: Check, label: "Done" },
  running: { color: "accent", icon: LoaderCircle, label: "Running" },
} as const;

const TranscriptItem = ({ item }: { item: AgentViewItem }) => {
  if (item.kind === "notice") {
    return (
      <Card
        className={cn(
          "mx-auto w-full max-w-2xl py-3",
          item.variant === "error" ? "border-danger/40" : "border-border"
        )}
        variant="secondary">
        <Card.Content className="flex flex-row items-start gap-2 text-sm">
          <CircleAlert
            className={cn(
              "mt-0.5 size-4 shrink-0",
              item.variant === "error" ? "text-danger" : "text-muted"
            )}
          />
          <p className="whitespace-pre-wrap">{item.text}</p>
        </Card.Content>
      </Card>
    );
  }

  if (item.kind === "tool") {
    const meta = statusMeta[item.status];
    const StatusIcon = meta.icon;
    const args = jsonOf(item.args);
    const details = jsonOf(item.details);

    return (
      <Card className="mx-auto w-full max-w-2xl py-3" variant="secondary">
        <Card.Header className="flex-row items-center gap-2">
          <Wrench className="text-muted size-4" />
          <Card.Title className="text-sm">{item.label}</Card.Title>
          <Chip className="ml-auto" color={meta.color} size="sm" variant="soft">
            <StatusIcon
              className={cn(
                "size-3",
                item.status === "running" && "animate-spin"
              )}
            />
            <Chip.Label>{meta.label}</Chip.Label>
          </Chip>
        </Card.Header>
        {item.summary ? (
          <Card.Content className="text-muted text-sm">
            {item.summary}
          </Card.Content>
        ) : null}
        {args || details ? (
          <Card.Footer className="flex-col items-stretch gap-2">
            {args ? (
              <details className="text-xs">
                <summary className="text-muted cursor-pointer">
                  Arguments
                </summary>
                <pre className="bg-surface mt-2 overflow-x-auto rounded-xl p-3 whitespace-pre-wrap">
                  {args}
                </pre>
              </details>
            ) : null}
            {details ? (
              <details className="text-xs">
                <summary className="text-muted cursor-pointer">Details</summary>
                <pre className="bg-surface mt-2 overflow-x-auto rounded-xl p-3 whitespace-pre-wrap">
                  {details}
                </pre>
              </details>
            ) : null}
          </Card.Footer>
        ) : null}
      </Card>
    );
  }

  const isUser = item.kind === "user";
  return (
    <div
      className={cn(
        "flex w-full gap-3",
        isUser ? "justify-end" : "justify-start"
      )}>
      {!isUser ? (
        <span className="bg-surface-secondary mt-1 flex size-8 shrink-0 items-center justify-center rounded-full">
          <Bot className="size-4" />
        </span>
      ) : null}
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 lg:max-w-[75%]",
          isUser
            ? "bg-accent text-accent-foreground rounded-br-md"
            : "bg-surface-secondary rounded-bl-md"
        )}>
        {item.thinking ? (
          <details className="mb-2 text-xs opacity-75">
            <summary className="cursor-pointer">Thinking</summary>
            <p className="mt-2 whitespace-pre-wrap">{item.thinking}</p>
          </details>
        ) : null}
        <p className="whitespace-pre-wrap">{item.text}</p>
        {item.streaming ? (
          <Spinner className="mt-2" color="current" size="sm" />
        ) : null}
      </div>
      {isUser ? (
        <span className="bg-surface-secondary mt-1 flex size-8 shrink-0 items-center justify-center rounded-full">
          <User className="size-4" />
        </span>
      ) : null}
    </div>
  );
};

export const AgentTranscript = ({ items, runStatus }: AgentTranscriptProps) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollKey = useMemo(() => {
    const last = items.at(-1);
    if (!last) return "empty";
    if (last.kind === "tool") {
      return `${last.toolCallId}:${last.status}:${last.summary?.length ?? 0}`;
    }
    if (last.kind === "notice") return `${last.variant}:${last.text.length}`;
    return `${last.messageId}:${last.text.length}:${last.thinking?.length ?? 0}`;
  }, [items]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ block: "end" });
    });
    return () => cancelAnimationFrame(frame);
  }, [scrollKey]);

  return (
    <ScrollShadow className="min-h-0 flex-1 px-4 py-5" size={56}>
      {items.length === 0 ? (
        <div className="text-muted flex min-h-72 flex-col items-center justify-center gap-3 text-center">
          <span className="bg-surface-secondary flex size-12 items-center justify-center rounded-full">
            <Bot className="size-6" />
          </span>
          <div>
            <p className="text-foreground font-medium">
              Start writing together
            </p>
            <p className="mt-1 max-w-sm text-sm">
              Ask for an outline, draft a new post, or refine an existing idea.
            </p>
          </div>
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
          {items.map((item, index) => (
            <TranscriptItem
              key={
                item.kind === "tool"
                  ? item.toolCallId
                  : item.kind === "notice"
                    ? `${item.variant}-${index}`
                    : item.messageId
              }
              item={item}
            />
          ))}
          {runStatus === "running" && items.at(-1)?.kind !== "assistant" ? (
            <div className="text-muted flex items-center gap-2 text-sm">
              <Spinner size="sm" />
              Agent is working…
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>
      )}
    </ScrollShadow>
  );
};
