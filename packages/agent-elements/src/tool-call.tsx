"use client";

import type { ComponentType } from "react";

import { Chip, Disclosure } from "@heroui/react";
import {
  Check,
  CircleX,
  LoaderCircle,
  ShieldAlert,
  Wrench,
} from "lucide-react";

import type { ToolCallView } from "@chia/agent-runtime/wire/fold";
import { cn } from "@chia/ui/utils/cn.util";

import { useAgentLabels } from "./provider.tsx";

/**
 * A kind-specific view of one tool's result. Keyed by tool name; receives the folded call.
 * The default rendering below shows arguments and result as JSON.
 */
export type ToolRenderer = ComponentType<{ tool: ToolCallView }>;
export type ToolRenderers = Readonly<Record<string, ToolRenderer>>;

export const jsonOf = <TValue,>(value: TValue): string | null => {
  if (value === undefined) return null;
  try {
    return JSON.stringify(value, null, 2) ?? null;
  } catch {
    return String(value);
  }
};

const statusMeta = {
  running: { color: "accent", icon: LoaderCircle, spin: true },
  ok: { color: "success", icon: Check, spin: false },
  error: { color: "danger", icon: CircleX, spin: false },
  awaiting_approval: { color: "warning", icon: ShieldAlert, spin: false },
} as const satisfies Record<
  ToolCallView["status"],
  {
    color: "accent" | "danger" | "success" | "warning";
    icon: ComponentType<{ className?: string }>;
    spin: boolean;
  }
>;

export const ToolStatusChip = ({ tool }: { tool: ToolCallView }) => {
  const labels = useAgentLabels();
  const meta = statusMeta[tool.status];
  const Icon = meta.icon;
  const label = {
    running: labels.toolRunning,
    ok: labels.toolDone,
    error: labels.toolFailed,
    awaiting_approval: labels.toolAwaitingApproval,
  }[tool.status];
  return (
    <Chip color={meta.color} size="sm" variant="soft">
      <Icon className={cn("size-3", meta.spin && "animate-spin")} />
      <Chip.Label>{label}</Chip.Label>
    </Chip>
  );
};

const JsonBlock = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col gap-1">
    <span className="text-muted text-[11px] tracking-wide uppercase">
      {label}
    </span>
    <pre className="bg-surface-secondary text-foreground max-h-64 overflow-auto rounded-lg p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
      {value}
    </pre>
  </div>
);

export const DefaultToolBody = ({ tool }: { tool: ToolCallView }) => {
  const labels = useAgentLabels();
  const args = jsonOf(tool.args);
  const details = jsonOf(tool.details);
  return (
    <div className="flex flex-col gap-3">
      {tool.summary ? (
        <p className="text-muted text-xs">{tool.summary}</p>
      ) : null}
      {args ? <JsonBlock label={labels.arguments} value={args} /> : null}
      {details ? <JsonBlock label={labels.result} value={details} /> : null}
    </div>
  );
};

export interface ToolCallProps {
  tool: ToolCallView;
  renderers?: ToolRenderers;
  className?: string;
}

export const ToolCall = ({ className, renderers, tool }: ToolCallProps) => {
  const Body = renderers?.[tool.toolName] ?? DefaultToolBody;
  return (
    <Disclosure
      className={cn("bg-surface border-border rounded-xl border", className)}>
      <Disclosure.Heading>
        <Disclosure.Trigger className="flex h-10 w-full items-center justify-start gap-2.5 px-3 text-left text-sm">
          <Wrench className="text-muted size-3.5 shrink-0" />
          <span className="text-foreground truncate">{tool.label}</span>
          <span className="text-muted hidden truncate font-mono text-xs sm:inline">
            {tool.toolName}
          </span>
          <span className="ml-auto flex shrink-0 items-center gap-2">
            <ToolStatusChip tool={tool} />
            <Disclosure.Indicator />
          </span>
        </Disclosure.Trigger>
      </Disclosure.Heading>
      <Disclosure.Content>
        <Disclosure.Body className="px-3 pb-3">
          <Body tool={tool} />
        </Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  );
};
