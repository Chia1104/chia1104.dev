"use client";

import type { FormEvent, ReactNode, RefObject } from "react";
import { useEffect, useId, useState, useSyncExternalStore } from "react";

import { Button, Input, Popover, TextField } from "@heroui/react";
import { Sparkles } from "lucide-react";

import { cn } from "@chia/ui/utils/cn.util";

/** Viewport box of the selected text; the trigger sits at its end. */
export interface SelectionRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

export interface DomSelection {
  text: string;
  rect: SelectionRect;
  /** Heading trail above the selection, `"Setup > Install"`, when the container has headings. */
  headingPath?: string;
}

/** Selection changes settle for this long before the trigger appears; a drag emits many. */
const SETTLE_MS = 150;

const HEADING_LEVEL = /^H([1-6])$/;

/**
 * The titles of the headings that enclose `node`, outermost first: a heading counts when it
 * precedes the node and no later heading of the same or a higher level has replaced it.
 */
const headingPathOf = (
  container: HTMLElement,
  node: Node
): string | undefined => {
  const stack: { level: number; title: string }[] = [];
  for (const heading of container.querySelectorAll("h1, h2, h3, h4, h5, h6")) {
    const follows =
      heading.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING;
    if (!follows) break;
    const level = Number(HEADING_LEVEL.exec(heading.tagName)?.[1] ?? 0);
    while (stack.length > 0 && stack.at(-1)!.level >= level) stack.pop();
    const title = heading.textContent?.trim();
    if (title) stack.push({ level, title });
  }
  return stack.length > 0
    ? stack.map((entry) => entry.title).join(" > ")
    : undefined;
};

const readSelection = (
  container: HTMLElement,
  within: string | undefined
): DomSelection | null => {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0)
    return null;
  const range = selection.getRangeAt(0);
  const scope = within ? container.querySelector(within) : container;
  if (!scope?.contains(range.commonAncestorContainer)) return null;
  const text = selection.toString().trim();
  if (!text) return null;
  // A range that ends at a block boundary reports an empty box; the last line has the real one.
  const rects = range.getClientRects();
  const box = range.getBoundingClientRect();
  const last = rects.length > 0 ? rects[rects.length - 1]! : box;
  return {
    text,
    rect: {
      top: box.top,
      left: box.left,
      right: last.right,
      bottom: last.bottom,
    },
    headingPath: headingPathOf(container, range.startContainer),
  };
};

/**
 * The text selected inside `containerRef`, or `null`. Reported once a selection has settled,
 * and re-measured on scroll and resize so the trigger follows the text. `within` narrows the
 * container to one descendant, e.g. the article body beside its table of contents.
 */
export const useDomSelection = (
  containerRef: RefObject<HTMLElement | null>,
  options: { within?: string } = {}
): DomSelection | null => {
  const [selection, setSelection] = useState<DomSelection | null>(null);
  const { within } = options;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let frame: number | undefined;
    const measure = () => setSelection(readSelection(container, within));
    const onChange = () => {
      clearTimeout(timer);
      timer = setTimeout(measure, SETTLE_MS);
    };
    const onMove = () => {
      if (frame !== undefined) return;
      frame = requestAnimationFrame(() => {
        frame = undefined;
        measure();
      });
    };
    document.addEventListener("selectionchange", onChange);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      clearTimeout(timer);
      if (frame !== undefined) cancelAnimationFrame(frame);
      document.removeEventListener("selectionchange", onChange);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [containerRef, within]);

  return selection;
};

export interface SelectionTriggerProps<T> {
  /** `null` hides the trigger, unless its menu is open: an open menu holds what it was opened with. */
  selection: T | null;
  /** Viewport point the trigger hangs from, usually the selection's bottom-right corner. */
  anchor: { top: number; left: number } | null;
  label: string;
  className?: string;
  children: (selection: T, close: () => void) => ReactNode;
}

/** Keeps the trigger inside the viewport with this margin. */
const EDGE_PX = 8;

const COARSE_POINTER = "(pointer: coarse)";

/**
 * Whether the primary pointer is a finger. Touch browsers draw their own selection toolbar
 * over the selected text, so the trigger keeps out of its way there.
 */
const useCoarsePointer = (): boolean =>
  useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(COARSE_POINTER);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(COARSE_POINTER).matches,
    () => false
  );

/**
 * A floating button at `anchor` that opens a menu for the current selection. While the menu is
 * open the selection it opened with is held, because clicking inside the menu collapses the
 * native selection. With a coarse pointer the button sits at the bottom of the viewport instead,
 * clear of the native selection toolbar.
 */
export const SelectionTrigger = <T,>({
  anchor,
  children,
  className,
  label,
  selection,
}: SelectionTriggerProps<T>) => {
  const [held, setHeld] = useState<{
    selection: T;
    anchor: { top: number; left: number };
  } | null>(null);
  const coarse = useCoarsePointer();
  const open = held !== null;
  const current = open ? held.selection : selection;
  const at = open ? held.anchor : anchor;
  if (current === null || at === null) return null;

  const close = () => setHeld(null);
  // Rendered only after a selection was measured in the browser, so the viewport exists.
  const style = coarse
    ? undefined
    : {
        top: at.top,
        left: Math.max(
          EDGE_PX,
          Math.min(at.left, window.innerWidth - EDGE_PX)
        ),
      };

  return (
    <Popover
      isOpen={open}
      onOpenChange={(next) => {
        if (next) setHeld({ selection: current, anchor: at });
        else close();
      }}>
      <Popover.Trigger>
        <Button
          aria-label={label}
          className={cn(
            "fixed z-50 h-7 gap-1.5 rounded-full px-2.5 text-xs shadow-md",
            coarse
              ? "bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] left-1/2 -translate-x-1/2"
              : "-translate-x-full",
            className
          )}
          size="sm"
          style={style}
          variant="secondary">
          <Sparkles className="size-3.5" />
          {label}
        </Button>
      </Popover.Trigger>
      <Popover.Content
        className="bg-surface/80 w-72 p-0 backdrop-blur-sm"
        offset={6}
        placement={coarse ? "top" : "bottom end"}>
        <Popover.Dialog className="p-2">
          {children(current, close)}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
};

export interface SelectionAction {
  id: string;
  label: string;
  onSelect: () => void;
}

export interface SelectionMenuProps {
  actions: readonly SelectionAction[];
  /** Rendered above the actions, e.g. the first line of the selected text. */
  preview?: ReactNode;
  /** Adds a prompt field; the caller attaches the selection and sends what was typed. */
  prompt?: {
    placeholder: string;
    submitLabel: string;
    onSubmit: (prompt: string) => void;
  };
}

/** Preset actions for a selection, and a free prompt where the host allows one. */
export const SelectionMenu = ({ actions, preview, prompt }: SelectionMenuProps) => {
  const [text, setText] = useState("");
  const inputId = useId();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const typed = text.trim();
    if (typed) prompt?.onSubmit(typed);
  };
  return (
    <div className="flex flex-col gap-1">
      {preview ? (
        <p className="text-muted border-border line-clamp-2 border-b px-2 pb-2 text-[11px]">
          {preview}
        </p>
      ) : null}
      {actions.map((action) => (
        <Button
          key={action.id}
          className="h-8 justify-start px-2 text-xs"
          onPress={action.onSelect}
          size="sm"
          variant="ghost">
          {action.label}
        </Button>
      ))}
      {prompt ? (
        <form className="flex items-center gap-1 pt-1" onSubmit={submit}>
          <TextField
            aria-label={prompt.placeholder}
            className="min-w-0 flex-1"
            id={inputId}
            onChange={setText}
            value={text}>
            <Input
              autoFocus
              className="h-8 text-xs"
              placeholder={prompt.placeholder}
            />
          </TextField>
          <Button
            className="h-8 px-2 text-xs"
            isDisabled={text.trim().length === 0}
            size="sm"
            type="submit"
            variant="primary">
            {prompt.submitLabel}
          </Button>
        </form>
      ) : null}
    </div>
  );
};
