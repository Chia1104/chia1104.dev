"use client";

import { ListBox } from "@heroui/react";

import { cn } from "@chia/ui/utils/cn.util";

import type { AgentLabels } from "./labels.ts";
import type { SlashMenuItem } from "./slash-command.ts";

export interface SlashMenuProps {
  activeId?: string;
  emptyText: string;
  id: string;
  items: readonly SlashMenuItem[];
  labels: AgentLabels;
  onAction: (item: SlashMenuItem) => void;
  onActiveChange: (id: string) => void;
}

export const SlashMenu = ({
  activeId,
  emptyText,
  id,
  items,
  labels,
  onAction,
  onActiveChange,
}: SlashMenuProps) => (
  <div className="bg-surface/70 border-border absolute inset-x-0 bottom-[calc(100%+0.5rem)] z-40 w-full max-w-[95%] justify-self-center overflow-hidden rounded-2xl border p-1.5 shadow-lg backdrop-blur-xl">
    <ListBox
      autoFocus
      aria-label={labels.slashMenu}
      className="max-h-[min(18rem,50vh)] overflow-y-auto focus:outline-none"
      id={id}
      onAction={(key) => {
        const item = items.find((candidate) => candidate.id === key);
        if (item) onAction(item);
      }}
      renderEmptyState={() => (
        <p className="text-muted px-3 py-8 text-center text-xs">{emptyText}</p>
      )}>
      {items.map((item) => (
        <ListBox.Item
          key={item.id}
          className={cn(
            "min-h-8 gap-3 px-2.5 py-1.5",
            item.id === activeId && "bg-surface-secondary"
          )}
          id={item.id}
          onHoverStart={() => onActiveChange(item.id)}
          textValue={`${item.label} ${item.description}`}>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-4">
            <span className="text-foreground min-w-0 shrink-0 truncate font-mono text-xs font-medium sm:w-52">
              {item.label}
              {item.argumentHint ? (
                <span className="text-muted font-normal">
                  {` ${item.argumentHint}`}
                </span>
              ) : null}
            </span>
            <span className="text-muted min-w-0 flex-1 truncate text-xs">
              {item.description}
            </span>
          </span>
        </ListBox.Item>
      ))}
    </ListBox>
    <div className="border-border text-muted flex items-center justify-between border-t px-3 pt-1.5 pb-0.5 text-[10px]">
      <span>{labels.slashMenuHint}</span>
      <span>{labels.slashMenuDismiss}</span>
    </div>
  </div>
);
