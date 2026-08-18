"use client";

import { useEffect, useMemo, useRef } from "react";

import { Card, Chip, ScrollShadow, Spinner } from "@heroui/react";
import type { UIMessage } from "@tanstack/ai-react";
import {
  Bot,
  Check,
  CircleAlert,
  CircleX,
  LoaderCircle,
  User,
  Wrench,
} from "lucide-react";

import { cn } from "@chia/ui/utils/cn.util";

interface AgentTranscriptProps {
  isRunning: boolean;
  messages: UIMessage[];
}

type ToolPart = Extract<UIMessage["parts"][number], { type: "tool-call" }>;

const jsonOf = <TValue,>(value: TValue) => {
  if (value === undefined) return null;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const toolStatus = {
  "approval-requested": {
    color: "warning",
    icon: CircleAlert,
    label: "Needs approval",
  },
  "approval-responded": {
    color: "accent",
    icon: LoaderCircle,
    label: "Running",
  },
  "awaiting-input": {
    color: "accent",
    icon: LoaderCircle,
    label: "Starting",
  },
  complete: { color: "success", icon: Check, label: "Done" },
  error: { color: "danger", icon: CircleX, label: "Failed" },
  "input-complete": {
    color: "accent",
    icon: LoaderCircle,
    label: "Running",
  },
  "input-streaming": {
    color: "accent",
    icon: LoaderCircle,
    label: "Running",
  },
} as const;

const ToolCard = ({ part }: { part: ToolPart }) => {
  const meta = toolStatus[part.state];
  const StatusIcon = meta.icon;
  const args = jsonOf(part.input);
  const output = jsonOf(part.output);

  return (
    <Card className="w-full py-3" variant="secondary">
      <Card.Header className="flex-row items-center gap-2">
        <Wrench className="text-muted size-4" />
        <Card.Title className="text-sm">{part.name}</Card.Title>
        <Chip className="ml-auto" color={meta.color} size="sm" variant="soft">
          <StatusIcon
            className={cn(
              "size-3",
              (part.state === "awaiting-input" ||
                part.state === "input-streaming" ||
                part.state === "input-complete" ||
                part.state === "approval-responded") &&
                "animate-spin"
            )}
          />
          <Chip.Label>{meta.label}</Chip.Label>
        </Chip>
      </Card.Header>
      {args || output ? (
        <Card.Footer className="flex-col items-stretch gap-2">
          {args ? (
            <details className="text-xs">
              <summary className="text-muted cursor-pointer">Arguments</summary>
              <pre className="bg-surface mt-2 overflow-x-auto rounded-xl p-3 whitespace-pre-wrap">
                {args}
              </pre>
            </details>
          ) : null}
          {output ? (
            <details className="text-xs">
              <summary className="text-muted cursor-pointer">Result</summary>
              <pre className="bg-surface mt-2 overflow-x-auto rounded-xl p-3 whitespace-pre-wrap">
                {output}
              </pre>
            </details>
          ) : null}
        </Card.Footer>
      ) : null}
    </Card>
  );
};

const TranscriptMessage = ({ message }: { message: UIMessage }) => {
  const isUser = message.role === "user";
  const thinking = message.parts
    .filter((part) => part.type === "thinking")
    .map((part) => part.content)
    .join("");
  const text = message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.content)
    .join("");
  const tools = message.parts.filter(
    (part): part is ToolPart => part.type === "tool-call"
  );
  const hasBubble = Boolean(text || thinking);

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
      <div className="flex max-w-[85%] flex-col gap-3 lg:max-w-[75%]">
        {hasBubble ? (
          <div
            className={cn(
              "rounded-2xl px-4 py-3 text-sm leading-6",
              isUser
                ? "bg-accent text-accent-foreground rounded-br-md"
                : "bg-surface-secondary rounded-bl-md"
            )}>
            {thinking ? (
              <details className="mb-2 text-xs opacity-75">
                <summary className="cursor-pointer">Thinking</summary>
                <p className="mt-2 whitespace-pre-wrap">{thinking}</p>
              </details>
            ) : null}
            {text ? <p className="whitespace-pre-wrap">{text}</p> : null}
          </div>
        ) : null}
        {tools.map((tool) => (
          <ToolCard key={tool.id} part={tool} />
        ))}
      </div>
      {isUser ? (
        <span className="bg-surface-secondary mt-1 flex size-8 shrink-0 items-center justify-center rounded-full">
          <User className="size-4" />
        </span>
      ) : null}
    </div>
  );
};

const messageScrollKey = (message: UIMessage | undefined): string => {
  if (!message) return "empty";
  let size = 0;
  let state = "";
  for (const part of message.parts) {
    if (part.type === "text" || part.type === "thinking") {
      size += part.content.length;
    } else if (part.type === "tool-call") {
      state = `${part.id}:${part.state}`;
    }
  }
  return `${message.id}:${size}:${state}`;
};

export const AgentTranscript = ({
  isRunning,
  messages,
}: AgentTranscriptProps) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollKey = useMemo(
    () => messageScrollKey(messages.at(-1)),
    [messages]
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ block: "end" });
    });
    return () => cancelAnimationFrame(frame);
  }, [scrollKey]);

  return (
    <ScrollShadow className="min-h-0 flex-1 px-4 py-5" size={56}>
      {messages.length === 0 ? (
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
          {messages.map((message) => (
            <TranscriptMessage key={message.id} message={message} />
          ))}
          {isRunning ? (
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
