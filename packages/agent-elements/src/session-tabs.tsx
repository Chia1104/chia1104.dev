"use client";

import { useMemo, useState } from "react";

import { Button, Popover, SearchField, ScrollShadow } from "@heroui/react";
import { ChevronDown, Plus } from "lucide-react";

import { cn } from "@chia/ui/utils/cn.util";

import { defaultAgentLabels } from "./labels.ts";
import type { AgentLabels } from "./labels.ts";
import type { AgentSessionSummary } from "./types.ts";

export interface SessionTabsProps {
  sessions: readonly AgentSessionSummary[];
  activeId: string | null;
  onSelect: (sessionId: string) => void;
  onCreate: () => void;
  isCreating?: boolean;
  /** How many sessions ride in the strip before the rest move behind "more". */
  visible?: number;
  formatTime?: (timestamp: number) => string;
  labels?: Partial<
    Pick<
      AgentLabels,
      | "moreSessions"
      | "newSession"
      | "noSessions"
      | "searchSessions"
      | "untitledSession"
    >
  >;
  className?: string;
}

const defaultFormatTime = (timestamp: number) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);

/**
 * Presentational: the host owns the session list (it already fetches it) and the current
 * selection. This is a strip of the most recent sessions plus a searchable overflow.
 */
export const SessionTabs = ({
  activeId,
  className,
  formatTime = defaultFormatTime,
  isCreating,
  labels: overrides,
  onCreate,
  onSelect,
  sessions,
  visible = 5,
}: SessionTabsProps) => {
  const labels = { ...defaultAgentLabels, ...overrides };
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const strip = sessions.slice(0, visible);
  const activeInStrip = strip.some((session) => session.id === activeId);
  const active = sessions.find((session) => session.id === activeId);
  // Keep the active session visible even when it has fallen out of the recent strip.
  const shown =
    active && !activeInStrip ? [active, ...strip.slice(0, visible - 1)] : strip;

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? sessions.filter((session) =>
          (session.title ?? labels.untitledSession)
            .toLowerCase()
            .includes(needle)
        )
      : sessions;
  }, [labels.untitledSession, query, sessions]);

  const pick = (sessionId: string) => {
    setOpen(false);
    setQuery("");
    onSelect(sessionId);
  };

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <Button
        className="shrink-0"
        isPending={isCreating}
        onPress={onCreate}
        size="sm"
        variant="secondary">
        <Plus className="size-4" />
        {labels.newSession}
      </Button>

      <div className="flex min-w-0 flex-1 [scrollbar-width:none] items-center gap-0.5 overflow-x-auto">
        {shown.map((session) => {
          const isActive = session.id === activeId;
          return (
            <Button
              key={session.id}
              className={cn(
                "h-8 max-w-48 shrink-0 justify-start px-3 text-xs font-normal",
                isActive && "bg-surface-secondary text-foreground"
              )}
              onPress={() => onSelect(session.id)}
              size="sm"
              variant={isActive ? "tertiary" : "ghost"}>
              <span className="truncate">
                {session.title ?? labels.untitledSession}
              </span>
            </Button>
          );
        })}
      </div>

      {sessions.length > shown.length ? (
        <Popover isOpen={open} onOpenChange={setOpen}>
          <Popover.Trigger>
            <Button
              className="text-muted h-8 shrink-0 gap-1 px-2.5 text-xs"
              size="sm"
              variant="ghost">
              {labels.moreSessions}
              <ChevronDown
                className={cn(
                  "size-3.5 transition-transform",
                  open && "rotate-180"
                )}
              />
            </Button>
          </Popover.Trigger>
          <Popover.Content className="w-80 p-0" placement="bottom end">
            <Popover.Dialog className="flex flex-col p-0">
              <div className="border-border border-b p-2">
                <SearchField
                  aria-label={labels.searchSessions}
                  autoFocus
                  fullWidth
                  onChange={setQuery}
                  value={query}>
                  <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input placeholder={labels.searchSessions} />
                    <SearchField.ClearButton />
                  </SearchField.Group>
                </SearchField>
              </div>
              <ScrollShadow className="max-h-80 p-1.5">
                {matches.length === 0 ? (
                  <p className="text-muted px-3 py-6 text-center text-xs">
                    {labels.noSessions}
                  </p>
                ) : (
                  <div className="flex flex-col">
                    {matches.map((session) => (
                      <Button
                        key={session.id}
                        className="h-auto justify-start px-2.5 py-2 text-left"
                        fullWidth
                        onPress={() => pick(session.id)}
                        size="sm"
                        variant={
                          session.id === activeId ? "tertiary" : "ghost"
                        }>
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="text-foreground truncate text-sm font-normal">
                            {session.title ?? labels.untitledSession}
                          </span>
                          <span className="text-muted text-[11px]">
                            {formatTime(session.updatedAt)}
                          </span>
                        </span>
                      </Button>
                    ))}
                  </div>
                )}
              </ScrollShadow>
            </Popover.Dialog>
          </Popover.Content>
        </Popover>
      ) : null}
    </div>
  );
};
