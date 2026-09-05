"use client";

import type { ReactNode } from "react";
import {
  memo,
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import { Alert, Button, CloseButton, TextArea } from "@heroui/react";
import { BorderBeam } from "border-beam";
import { ArrowUp, Square, X } from "lucide-react";

import { cn } from "@chia/ui/utils/cn.util";

import {
  composerDraftOf,
  composerDraftReducer,
  initialComposerDraft,
} from "./composer-draft.ts";
import type { ComposerDraft } from "./composer-draft.ts";
import { ContextUsage } from "./context-usage.tsx";
import { useAgentLabels } from "./labels-context.tsx";
import { fill } from "./labels.ts";
import {
  useAbortSession,
  useAgentCapabilities,
  useAgentBusy,
  useAgentSession,
  useAgentStatus,
  useCanPrompt,
} from "./provider.tsx";
import { SessionModelPicker } from "./session-model-picker.tsx";
import {
  filterSlashMenuItems,
  findSlashCommand,
  parseSlashCommand,
  removeSlashToken,
  replaceSlashToken,
  slashTokenAt,
} from "./slash-command.ts";
import type { SlashMenuItem, SlashToken } from "./slash-command.ts";
import { SlashMenu } from "./slash-menu.tsx";
import type { AgentAttachmentInput, ComposerSeed } from "./store.ts";
import type { AgentCapabilities } from "./types.ts";

/** Tallest the input grows before it scrolls, in px (~eight lines). */
const MAX_INPUT_HEIGHT = 200;

export interface ComposerProps {
  className?: string;
  placeholder?: string;
  /** Left of send. Defaults to the model picker; pass `null` for none. */
  toolbar?: ReactNode;
  /** Stacked above the input. Compose from `ComposerAttachment` rows. */
  attachments?: ReactNode;
  /** Sent with the next plain prompt; slash commands carry none. */
  pendingAttachments?: readonly AgentAttachmentInput[];
  /** Tucked under the input. Defaults to `ComposerStatus`; pass `null` for none. */
  footer?: ReactNode;
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
  meta?: ReactNode;
  /** An explicit control at the row's end; separate from the row press so the two never compete. */
  action?: ReactNode;
  onPress?: () => void;
  onDismiss?: () => void;
  className?: string;
}

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

/** Host-local commands shadow server ones. */
const useSlashMenuItems = (
  localCommands: readonly ComposerLocalCommand[],
  capabilities: AgentCapabilities | undefined
) =>
  useMemo(() => {
    const items: SlashMenuItem[] = localCommands.map((item) => ({
      id: `local:${item.name}`,
      kind: "command",
      name: item.name,
      label: `/${item.name}`,
      description: item.description,
      local: true,
    }));
    const commandNames = new Set(localCommands.map((item) => item.name));
    for (const item of capabilities?.commands ?? []) {
      if (commandNames.has(item.name)) continue;
      commandNames.add(item.name);
      items.push({
        id: `command:${item.name}`,
        kind: "command",
        name: item.name,
        label: `/${item.name}`,
        description: item.description,
        argumentHint: item.argumentHint,
      });
    }
    for (const item of capabilities?.skills ?? []) {
      items.push({
        id: `skill:${item.name}`,
        kind: "skill",
        name: item.name,
        label: `skill:${item.name}`,
        description: item.description,
      });
    }
    return { items, commandNames };
  }, [capabilities, localCommands]);

const useStableCallback = <Args extends unknown[], Result>(
  fn: (...args: Args) => Result
) => {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback((...args: Args) => ref.current(...args), []);
};

const ComposerFailure = () => {
  const labels = useAgentLabels();
  const failure = useAgentSession((state) => state.failure);
  const dismissFailure = useAgentSession((state) => state.dismissFailure);
  if (!failure) return null;
  return (
    <Alert status="danger" className="bg-surface-secondary gap-2 px-2.5 py-2">
      <Alert.Content>
        <Alert.Description className="break-words">{failure}</Alert.Description>
      </Alert.Content>
      <CloseButton aria-label={labels.dismiss} onPress={dismissFailure} />
    </Alert>
  );
};

export const ComposerStatus = () => {
  const labels = useAgentLabels();
  const status = useAgentStatus();
  return (
    <div className="text-muted flex min-h-8 items-center justify-between px-2 py-1 text-[11px]">
      <span>{labels.composerHint}</span>
      <span>
        {status === "running"
          ? labels.statusStreaming
          : status === "awaiting_approval"
            ? labels.statusAwaitingApproval
            : labels.statusReady}
      </span>
    </div>
  );
};

/** Negative margin tucks rows under the composer. A bottom well is `z-0` so it cannot paint over the input. */
const ComposerWell = ({
  children,
  side,
}: {
  children: ReactNode;
  side: "top" | "bottom";
}) => (
  <div
    className={cn(
      "bg-surface-secondary border-border divide-border max-h-40 w-full max-w-[95%] divide-y self-center overflow-y-auto border",
      side === "top"
        ? "-mb-5 rounded-t-2xl border-b-0 pb-3"
        : "relative z-0 -mt-5 rounded-b-2xl border-t-0 pt-3"
    )}>
    {children}
  </div>
);

interface ComposerToolbarProps {
  isEmpty: boolean;
  modelPickerOpen: boolean;
  onModelPickerOpenChange: (isOpen: boolean) => void;
  onSend: () => void;
  toolbar: ReactNode;
}

/** Memoized so typing in the input does not re-render the picker, usage ring and buttons. */
const ComposerToolbar = memo(
  ({
    isEmpty,
    modelPickerOpen,
    onModelPickerOpenChange,
    onSend,
    toolbar,
  }: ComposerToolbarProps) => {
    const labels = useAgentLabels();
    const abort = useAbortSession();
    const canPrompt = useCanPrompt();
    const busy = useAgentBusy();
    return (
      <div className="z-20 flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          {toolbar === undefined ? (
            <SessionModelPicker
              isOpen={modelPickerOpen}
              onOpenChange={onModelPickerOpenChange}
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
            isDisabled={!canPrompt || isEmpty}
            isIconOnly
            onPress={onSend}
            size="sm">
            <ArrowUp className="size-4" />
          </Button>
        )}
      </div>
    );
  }
);
ComposerToolbar.displayName = "ComposerToolbar";

/**
 * Remounted via `key={seed?.id}` so a composer seed is a fresh editor, not a patch into a
 * running draft.
 */
export const Composer = (props: ComposerProps) => {
  const seed = useAgentSession((state) => state.composerSeed);
  return <ComposerEditor key={seed?.id ?? 0} seed={seed} {...props} />;
};

const initialDraftOf = (seed: ComposerSeed | null): ComposerDraft =>
  seed ? composerDraftOf(seed.text) : initialComposerDraft;

const ComposerEditor = ({
  attachments,
  className,
  footer = <ComposerStatus />,
  localCommands,
  pendingAttachments,
  placeholder,
  seed,
  toolbar,
}: ComposerProps & { seed: ComposerSeed | null }) => {
  const labels = useAgentLabels();
  const prompt = useAgentSession((state) => state.prompt);
  const command = useAgentSession((state) => state.command);
  const reportFailure = useAgentSession((state) => state.reportFailure);
  const capabilities = useAgentCapabilities();
  const canPrompt = useCanPrompt();
  const busy = useAgentBusy();
  const status = useAgentStatus();
  const [draft, dispatch] = useReducer(
    composerDraftReducer,
    seed,
    initialDraftOf
  );
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  /**
   * Cursor to restore once the next text commit lands; `null` leaves focus where it is. A seeded
   * editor starts with the caret at the end of the seed, so the first layout pass focuses it.
   */
  const pendingSelection = useRef<number | null>(seed?.text.length ?? null);
  const menuId = useId();
  const { text, cursor, highlightedId, activeDescendantId, dismissedSlashKey } =
    draft;

  const resolvedLocalCommands = useMemo<readonly ComposerLocalCommand[]>(
    () => [
      ...(toolbar === undefined
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
    [labels.switchModel, localCommands, toolbar]
  );
  const { items: menuItems, commandNames } = useSlashMenuItems(
    resolvedLocalCommands,
    capabilities.data
  );

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

  // Grow the input up to a cap, then restore focus and the caret if an edit asked for it. Keyed
  // on the draft object rather than the text so a replacement that lands on identical text still
  // restores focus.
  useLayoutEffect(() => {
    const element = inputRef.current;
    if (!element) return;
    element.style.height = "0px";
    const next = Math.min(element.scrollHeight, MAX_INPUT_HEIGHT);
    element.style.height = `${next}px`;
    element.style.overflowY =
      element.scrollHeight > MAX_INPUT_HEIGHT ? "auto" : "hidden";

    const selection = pendingSelection.current;
    if (selection === null) return;
    pendingSelection.current = null;
    element.focus();
    element.setSelectionRange(selection, selection);
  }, [draft]);

  const replaceText = (
    edit: { text: string; cursor: number },
    focus = true
  ) => {
    if (focus) pendingSelection.current = edit.cursor;
    dispatch({ type: "replace", ...edit });
  };

  const selectMenuItem = (item: SlashMenuItem, token: SlashToken) => {
    if (item.kind === "skill") {
      replaceText(replaceSlashToken(text, token, `skill:${item.name} `));
      return;
    }
    if (item.local) {
      replaceText(removeSlashToken(text, token), false);
      resolvedLocalCommands
        .find((commandItem) => commandItem.name === item.name)
        ?.onSelect();
      return;
    }
    replaceText(replaceSlashToken(text, token, `/${item.name} `));
  };

  /** Clears the input optimistically; a request that never left gives the text back to retry. */
  const submit = async (value: string, request: () => Promise<void>) => {
    replaceText({ text: "", cursor: 0 }, false);
    try {
      await request();
    } catch {
      replaceText({ text: value, cursor: value.length }, false);
    }
  };

  const send = useStableCallback(async () => {
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
        replaceText(removeSlashToken(value, parsed.token), false);
        local.onSelect();
        return;
      }
      await submit(value, () => command(name, args, value));
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

    await submit(value, () =>
      prompt(value, { attachments: pendingAttachments })
    );
  });

  const onMenuAction = (item: SlashMenuItem) => {
    if (slashToken) selectMenuItem(item, slashToken);
  };
  const onMenuActiveChange = useCallback(
    (id: string) => dispatch({ type: "highlight", id }),
    []
  );
  const onActiveDescendantChange = useCallback(
    (id: string | undefined) =>
      dispatch({ type: "reportActiveDescendant", id }),
    []
  );

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
            onAction={onMenuAction}
            onActiveChange={onMenuActiveChange}
            onActiveDescendantChange={onActiveDescendantChange}
          />
        ) : null}
        <ComposerFailure />

        {attachments ? (
          <ComposerWell side="top">{attachments}</ComposerWell>
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
              onChange={(event) =>
                dispatch({
                  type: "replace",
                  text: event.target.value,
                  cursor: event.target.selectionStart,
                })
              }
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing) return;
                if (menuOpen && event.key === "Escape") {
                  event.preventDefault();
                  dispatch({ type: "dismissMenu", key: slashKey! });
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
                  dispatch({
                    type: "highlight",
                    id: visibleMenuItems[next]?.id,
                  });
                  return;
                }
                if (
                  menuOpen &&
                  activeItem &&
                  (event.key === "Enter" || event.key === "Tab")
                ) {
                  event.preventDefault();
                  selectMenuItem(activeItem, slashToken!);
                  return;
                }
                if (event.key !== "Enter" || event.shiftKey || event.altKey) {
                  return;
                }
                event.preventDefault();
                void send();
              }}
              onSelect={(event) =>
                dispatch({
                  type: "moveCursor",
                  cursor: event.currentTarget.selectionStart,
                })
              }
              placeholder={composerPlaceholder}
              rows={1}
              value={text}
              variant="secondary"
            />
            <ComposerToolbar
              isEmpty={text.trim().length === 0}
              modelPickerOpen={modelPickerOpen}
              onModelPickerOpenChange={setModelPickerOpen}
              onSend={send}
              toolbar={toolbar}
            />
          </div>
        </BorderBeam>

        {footer ? <ComposerWell side="bottom">{footer}</ComposerWell> : null}
      </div>
    </div>
  );
};
