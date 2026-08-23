"use client";

import type { ReactNode } from "react";
import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";

import { Alert, Button, CloseButton, TextArea } from "@heroui/react";
import { BorderBeam } from "border-beam";
import { ArrowUp, Square, X } from "lucide-react";

import { cn } from "@chia/ui/utils/cn.util";

import { ContextUsage } from "./context-usage.tsx";
import { fill } from "./labels.ts";
import { ModelPicker } from "./model-picker.tsx";
import {
  useAbortSession,
  useAgentCapabilities,
  useAgentBusy,
  useAgentLabels,
  useAgentSession,
  useAgentStatus,
  useCanPrompt,
} from "./provider.tsx";
import {
  filterSlashMenuItems,
  findSlashCommand,
  parseSlashCommand,
  removeSlashToken,
  replaceSlashToken,
  slashTokenAt,
} from "./slash-command.ts";
import type { SlashMenuItem } from "./slash-command.ts";
import { SlashMenu } from "./slash-menu.tsx";

/** Tallest the input grows before it scrolls, in px — about eight lines. */
const MAX_INPUT_HEIGHT = 200;

export interface ComposerProps {
  className?: string;
  /** Overrides the placeholder while the composer accepts input. */
  placeholder?: string;
  /**
   * Controls on the toolbar's left, beside the send button. Defaults to the model picker; pass
   * `null` for none.
   */
  toolbar?: ReactNode;
  /**
   * Stacked above the input and tucked under its top edge: the context the next prompt acts on
   * (drafts, attachments, pending items). Compose from `ComposerAttachment` rows.
   */
  attachments?: ReactNode;
  /** Client-only commands that act on the composer UI instead of starting an agent turn. */
  localCommands?: readonly ComposerLocalCommand[];
}

export interface ComposerLocalCommand {
  name: string;
  description: string;
  onSelect: () => void;
}

export interface ComposerAttachmentProps {
  icon: ReactNode;
  label: ReactNode;
  /** Trailing detail beside the label, e.g. a locale or status chip. */
  meta?: ReactNode;
  /** An explicit control at the row's end; separate from the row press so the two never compete. */
  action?: ReactNode;
  /** Makes the whole row a button. */
  onPress?: () => void;
  /** Adds a trailing dismiss button. */
  onDismiss?: () => void;
  className?: string;
}

/** One row in the composer's attachment stack. */
export const ComposerAttachment = ({
  action,
  className,
  icon,
  label,
  meta,
  onDismiss,
  onPress,
}: ComposerAttachmentProps) => {
  const labels = useAgentLabels();
  const body = (
    <>
      <span className="text-muted flex size-4 shrink-0 items-center justify-center [&>svg]:size-3">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-left text-xs">{label}</span>
      {meta}
    </>
  );

  return (
    <div
      className={cn(
        "text-foreground flex min-h-8 items-center gap-2 px-2 py-1",
        className
      )}>
      {onPress ? (
        <button
          className="hover:text-foreground text-foreground/80 focus-visible:ring-focus flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md transition-colors outline-none focus-visible:ring-2"
          onClick={onPress}
          type="button">
          {body}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2">{body}</div>
      )}
      {action}
      {onDismiss ? (
        <Button
          aria-label={labels.dismiss}
          isIconOnly
          onPress={onDismiss}
          size="sm"
          variant="ghost">
          <X className="size-3.5" />
        </Button>
      ) : null}
    </div>
  );
};

/**
 * The input on top, a toolbar below: model picker (or whatever the host puts there) on the left,
 * send/stop on the right. The input grows with its content up to a cap, then scrolls.
 */
export const Composer = ({
  attachments,
  className,
  localCommands,
  placeholder,
  toolbar,
}: ComposerProps) => {
  const labels = useAgentLabels();
  const prompt = useAgentSession((state) => state.prompt);
  const command = useAgentSession((state) => state.command);
  const reportFailure = useAgentSession((state) => state.reportFailure);
  const dismissFailure = useAgentSession((state) => state.dismissFailure);
  const failure = useAgentSession((state) => state.failure);
  const capabilities = useAgentCapabilities();
  const abort = useAbortSession();
  const canPrompt = useCanPrompt();
  const busy = useAgentBusy();
  const status = useAgentStatus();
  const [text, setText] = useState("");
  const [cursor, setCursor] = useState(0);
  const [activeDescendantId, setActiveDescendantId] = useState<string>();
  const [highlightedId, setHighlightedId] = useState<string>();
  const [dismissedSlashKey, setDismissedSlashKey] = useState<string>();
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const menuId = useId();
  const usesDefaultToolbar = toolbar === undefined;

  const resolvedLocalCommands = useMemo<readonly ComposerLocalCommand[]>(
    () => [
      ...(usesDefaultToolbar
        ? [
            {
              name: "model",
              description: labels.switchModel,
              onSelect: () => setModelPickerOpen(true),
            },
          ]
        : []),
      ...(localCommands ?? []),
    ],
    [labels.switchModel, localCommands, usesDefaultToolbar]
  );

  const menuItems = useMemo<SlashMenuItem[]>(() => {
    const items: SlashMenuItem[] = resolvedLocalCommands.map((item) => ({
      id: `local:${item.name}`,
      kind: "command",
      name: item.name,
      label: `/${item.name}`,
      description: item.description,
      local: true,
    }));
    const localNames = new Set(resolvedLocalCommands.map((item) => item.name));
    for (const item of capabilities.data?.commands ?? []) {
      if (localNames.has(item.name)) continue;
      items.push({
        id: `command:${item.name}`,
        kind: "command",
        name: item.name,
        label: `/${item.name}`,
        description: item.description,
        argumentHint: item.argumentHint,
      });
    }
    for (const item of capabilities.data?.skills ?? []) {
      items.push({
        id: `skill:${item.name}`,
        kind: "skill",
        name: item.name,
        label: `skill:${item.name}`,
        description: item.description,
      });
    }
    return items;
  }, [capabilities.data, resolvedLocalCommands]);

  const slashToken = slashTokenAt(text, cursor);
  const slashKey = slashToken
    ? `${text}\u0000${slashToken.start}\u0000${slashToken.query}`
    : undefined;
  const visibleMenuItems = useMemo(
    () => filterSlashMenuItems(menuItems, slashToken?.query ?? ""),
    [menuItems, slashToken?.query]
  );
  const activeItem =
    visibleMenuItems.find((item) => item.id === highlightedId) ??
    visibleMenuItems[0];
  const menuOpen =
    canPrompt && slashToken !== null && dismissedSlashKey !== slashKey;

  const commandNames = useMemo(
    () =>
      new Set([
        ...resolvedLocalCommands.map((item) => item.name),
        ...(capabilities.data?.commands.map((item) => item.name) ?? []),
      ]),
    [capabilities.data?.commands, resolvedLocalCommands]
  );

  const applyTextEdit = (
    edit: { text: string; cursor: number },
    focus = true
  ) => {
    setText(edit.text);
    setCursor(edit.cursor);
    if (!focus) return;
    requestAnimationFrame(() => {
      const input = inputRef.current;
      input?.focus();
      input?.setSelectionRange(edit.cursor, edit.cursor);
    });
  };

  const selectMenuItem = (item: SlashMenuItem) => {
    if (!slashToken) return;
    setHighlightedId(undefined);
    setDismissedSlashKey(undefined);
    if (item.kind === "skill") {
      applyTextEdit(replaceSlashToken(text, slashToken, `skill:${item.name} `));
      return;
    }
    if (item.local) {
      applyTextEdit(removeSlashToken(text, slashToken), false);
      resolvedLocalCommands
        .find((commandItem) => commandItem.name === item.name)
        ?.onSelect();
      return;
    }
    applyTextEdit(replaceSlashToken(text, slashToken, `/${item.name} `));
  };

  // Grow with the content: measure the natural height, cap it, and let the rest scroll.
  useLayoutEffect(() => {
    const element = inputRef.current;
    if (!element) return;
    element.style.height = "0px";
    const next = Math.min(element.scrollHeight, MAX_INPUT_HEIGHT);
    element.style.height = `${next}px`;
    element.style.overflowY =
      element.scrollHeight > MAX_INPUT_HEIGHT ? "auto" : "hidden";
  }, [text]);

  const send = async () => {
    const value = text.trim();
    if (!value || !canPrompt) return;

    const parsed = findSlashCommand(value, commandNames);
    if (parsed.type === "invalid") {
      reportFailure(labels.invalidCommandSyntax);
      return;
    }
    if (parsed.type === "command") {
      const { args, name } = parsed.command;
      const local = resolvedLocalCommands.find((item) => item.name === name);
      if (local) {
        if (parsed.token.start === 0 && args.length > 0) {
          reportFailure(
            fill(labels.commandTakesNoArguments, { command: `/${name}` })
          );
          return;
        }
        applyTextEdit(removeSlashToken(value, parsed.token), false);
        local.onSelect();
        return;
      }
      setText("");
      setCursor(0);
      try {
        await command(name, args, value);
      } catch {
        setText(value);
        setCursor(value.length);
      }
      return;
    }

    const leading = parseSlashCommand(value);
    if (leading.type === "invalid") {
      reportFailure(labels.invalidCommandSyntax);
      return;
    }
    if (leading.type === "command") {
      reportFailure(
        fill(labels.unknownCommand, { command: `/${leading.command.name}` })
      );
      return;
    }

    setText("");
    setCursor(0);
    try {
      await prompt(value);
    } catch {
      // The request never left: give the operator their text back to retry.
      setText(value);
      setCursor(value.length);
    }
  };

  const composerPlaceholder =
    status === "awaiting_approval"
      ? labels.composerPlaceholderApproval
      : busy
        ? labels.composerPlaceholderRunning
        : (placeholder ?? labels.composerPlaceholder);

  return (
    <div className={cn("shrink-0 px-4 pt-2 pb-4", className)}>
      <div className="relative mx-auto flex w-full max-w-3xl flex-col gap-2">
        {menuOpen ? (
          <SlashMenu
            activeId={activeItem?.id}
            emptyText={
              capabilities.isLoading
                ? labels.loadingCommands
                : labels.noMatchingCommands
            }
            id={menuId}
            items={visibleMenuItems}
            labels={labels}
            onAction={selectMenuItem}
            onActiveChange={setHighlightedId}
            onActiveDescendantChange={setActiveDescendantId}
          />
        ) : null}
        {failure ? (
          <Alert status="danger">
            <Alert.Content>
              <Alert.Description className="break-words">
                {failure}
              </Alert.Description>
            </Alert.Content>
            <CloseButton aria-label={labels.dismiss} onPress={dismissFailure} />
          </Alert>
        ) : null}

        {attachments ? (
          <div className="bg-surface-secondary border-border divide-border -mb-5 max-h-40 w-full max-w-[95%] divide-y self-center overflow-y-auto rounded-t-2xl border border-b-0 pb-3">
            {attachments}
          </div>
        ) : null}

        <BorderBeam
          className="relative z-10"
          duration={3.5}
          size="pulse-inner"
          theme="light"
          strength={100}>
          <div className="bg-surface border-border focus-within:border-field-border-focus flex flex-col gap-1 rounded-2xl border px-3 pt-3 pb-2 shadow-xs transition-colors">
            <TextArea
              ref={inputRef}
              aria-activedescendant={menuOpen ? activeDescendantId : undefined}
              aria-controls={menuOpen ? menuId : undefined}
              aria-expanded={menuOpen}
              aria-haspopup="listbox"
              aria-label={labels.send}
              className="min-h-10 w-full resize-none rounded-none border-0 bg-transparent p-0 text-sm leading-6 shadow-none focus:ring-0"
              disabled={!canPrompt}
              onChange={(event) => {
                setCursor(event.target.selectionStart);
                setActiveDescendantId(undefined);
                setDismissedSlashKey(undefined);
                setHighlightedId(undefined);
                setText(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing) return;
                if (menuOpen && event.key === "Escape") {
                  event.preventDefault();
                  setDismissedSlashKey(slashKey);
                  return;
                }
                if (
                  menuOpen &&
                  (event.key === "ArrowDown" || event.key === "ArrowUp")
                ) {
                  event.preventDefault();
                  if (visibleMenuItems.length === 0) return;
                  const current = activeItem
                    ? visibleMenuItems.indexOf(activeItem)
                    : 0;
                  const offset = event.key === "ArrowDown" ? 1 : -1;
                  const next =
                    (current + offset + visibleMenuItems.length) %
                    visibleMenuItems.length;
                  setHighlightedId(visibleMenuItems[next]?.id);
                  return;
                }
                if (
                  menuOpen &&
                  activeItem &&
                  (event.key === "Enter" || event.key === "Tab")
                ) {
                  event.preventDefault();
                  selectMenuItem(activeItem);
                  return;
                }
                if (event.key !== "Enter" || event.shiftKey || event.altKey) {
                  return;
                }
                event.preventDefault();
                void send();
              }}
              onSelect={(event) => {
                setCursor(event.currentTarget.selectionStart);
                setHighlightedId(undefined);
              }}
              placeholder={composerPlaceholder}
              rows={1}
              value={text}
              variant="secondary"
            />
            <div className="z-20 flex items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-1">
                {usesDefaultToolbar ? (
                  <ModelPicker
                    isOpen={modelPickerOpen}
                    onOpenChange={setModelPickerOpen}
                  />
                ) : (
                  toolbar
                )}
              </div>
              <ContextUsage />
              {busy ? (
                <Button
                  aria-label={labels.stop}
                  isIconOnly
                  isPending={abort.isPending}
                  onPress={() => abort.mutate()}
                  size="sm"
                  variant="danger-soft">
                  <Square className="size-3.5 fill-current" />
                </Button>
              ) : (
                <Button
                  aria-label={labels.send}
                  className="rounded-full"
                  isDisabled={!canPrompt || !text.trim()}
                  isIconOnly
                  onPress={() => void send()}
                  size="sm">
                  <ArrowUp className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </BorderBeam>

        <div className="text-muted flex justify-between px-1 text-[11px]">
          <span>{labels.composerHint}</span>
          <span>
            {status === "running"
              ? labels.statusStreaming
              : status === "awaiting_approval"
                ? labels.statusAwaitingApproval
                : labels.statusReady}
          </span>
        </div>
      </div>
    </div>
  );
};
