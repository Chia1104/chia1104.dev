"use client";

import type { KeyboardEvent, PointerEvent, ReactNode } from "react";
import { useEffect, useRef } from "react";

import { Button } from "@heroui/react";
import { Maximize2, Minimize2, X } from "lucide-react";
import { useLocalStorage } from "usehooks-ts";

import { cn } from "../utils/cn.util";
import useIsomorphicLayoutEffect from "../utils/use-isomorphic-layout-effect";

export type DockMode = "closed" | "open" | "maximized";

/**
 * Set on the root while the dock is open, so the page can give up the width without subscribing
 * to the dock's state. It carries the viewport clamp, so consumers only need a `0px` fallback.
 */
export const DOCK_WIDTH_VARIABLE = "--dock-width";

/** Set on the root for the length of a drag; width transitions pause so the panel keeps up. */
export const DOCK_RESIZING_ATTRIBUTE = "data-dock-resizing";

const DEFAULT_PAGE_MIN_WIDTH = 400;
const KEYBOARD_STEP = 16;
const DEFAULT_MIN_WIDTH = 320;
const DEFAULT_MAX_WIDTH = 768;

interface WidthBounds {
  minWidth: number;
  maxWidth: number;
  pageMinWidth: number;
}

/** The width the dock can take on the viewport it is on. */
const widthExpression = (
  width: number,
  { minWidth, pageMinWidth }: WidthBounds
) => `clamp(${minWidth}px, ${width}px, calc(100vw - ${pageMinWidth}px))`;

const clampWidth = (
  width: number,
  { minWidth, maxWidth, pageMinWidth }: WidthBounds
) =>
  Math.round(
    Math.max(
      minWidth,
      Math.min(width, maxWidth, window.innerWidth - pageMinWidth)
    )
  );

export interface DockShellProps {
  mode: DockMode;
  onModeChange: (mode: DockMode) => void;
  /** localStorage key for the width: a preference, so it outlives the tab. */
  storageKey: string;
  defaultWidth: number;
  minWidth?: number;
  maxWidth?: number;
  /** What the page keeps beside an open dock; a host with a sidebar needs more than a plain page. */
  pageMinWidth?: number;
  /** Accessible name of the panel. */
  label: string;
  /** Accessible name of the resize handle. */
  resizeLabel: string;
  className?: string;
  children: ReactNode;
}

/**
 * The wide-screen host of a panel that sits beside the page: a column the operator can drag
 * wider, or grow to the viewport. One element changes shape across modes, so the panel inside
 * never remounts and an in-flight conversation is not interrupted.
 */
export const DockShell = ({
  mode,
  onModeChange,
  storageKey,
  defaultWidth,
  minWidth = DEFAULT_MIN_WIDTH,
  maxWidth = DEFAULT_MAX_WIDTH,
  pageMinWidth = DEFAULT_PAGE_MIN_WIDTH,
  label,
  resizeLabel,
  className,
  children,
}: DockShellProps) => {
  const [width, setWidth] = useLocalStorage(storageKey, defaultWidth, {
    initializeWithValue: false,
  });
  // The width a drag has reached; committed to the store once, when the pointer lifts.
  const dragged = useRef<number | null>(null);
  const bounds: WidthBounds = { minWidth, maxWidth, pageMinWidth };

  useIsomorphicLayoutEffect(() => {
    if (mode === "closed") return;
    const root = document.documentElement;
    root.style.setProperty(DOCK_WIDTH_VARIABLE, widthExpression(width, bounds));
    return () => {
      root.style.removeProperty(DOCK_WIDTH_VARIABLE);
    };
  }, [mode, width, minWidth, pageMinWidth]);

  // The maximized panel covers the page, so it borrows a modal's manners: no scrolling underneath,
  // and Escape brings the column back. An overlay inside the panel claims Escape first.
  useEffect(() => {
    if (mode !== "maximized") return;
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        onModeChange("open");
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      root.style.overflow = overflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mode, onModeChange]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const root = document.documentElement;
    root.setAttribute(DOCK_RESIZING_ATTRIBUTE, "");
    root.style.cursor = "col-resize";
    root.style.userSelect = "none";
    dragged.current = width;
  };

  // Writing the variable directly keeps the panel from re-rendering on every pointer move.
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragged.current === null) return;
    const next = clampWidth(window.innerWidth - event.clientX, bounds);
    dragged.current = next;
    document.documentElement.style.setProperty(
      DOCK_WIDTH_VARIABLE,
      widthExpression(next, bounds)
    );
  };

  const onPointerUp = () => {
    if (dragged.current === null) return;
    const root = document.documentElement;
    root.removeAttribute(DOCK_RESIZING_ATTRIBUTE);
    root.style.cursor = "";
    root.style.userSelect = "";
    setWidth(dragged.current);
    dragged.current = null;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = (() => {
      switch (event.key) {
        case "ArrowLeft":
          return width + KEYBOARD_STEP;
        case "ArrowRight":
          return width - KEYBOARD_STEP;
        case "Home":
          return minWidth;
        case "End":
          return maxWidth;
        default:
          return null;
      }
    })();
    if (next === null) return;
    event.preventDefault();
    setWidth(clampWidth(next, bounds));
  };

  const columnWidth = `var(${DOCK_WIDTH_VARIABLE}, ${width}px)`;
  const transition =
    "transition-[width] duration-200 ease-out motion-reduce:transition-none [html[data-dock-resizing]_&]:transition-none";

  return (
    <aside
      aria-label={label}
      className={cn(
        // `bg-overlay` is the drawer's own surface, so the panel reads the same either way.
        "bg-overlay fixed inset-y-0 right-0 z-20 overflow-hidden",
        transition,
        mode === "open" ? "border-border border-l" : null,
        className
      )}
      data-mode={mode}
      style={{
        width: mode === "closed" ? 0 : mode === "open" ? columnWidth : "100%",
      }}>
      <div
        className={cn("flex h-full flex-col", transition)}
        style={{ width: mode === "maximized" ? "100%" : columnWidth }}>
        {children}
      </div>
      {mode === "open" ? (
        <div
          aria-label={resizeLabel}
          aria-orientation="vertical"
          aria-valuemax={maxWidth}
          aria-valuemin={minWidth}
          aria-valuenow={width}
          className="hover:bg-default focus-visible:bg-default absolute inset-y-0 left-0 w-1.5 cursor-col-resize touch-none transition-colors outline-none"
          onDoubleClick={() => setWidth(defaultWidth)}
          onKeyDown={onKeyDown}
          onPointerCancel={onPointerUp}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          role="separator"
          tabIndex={0}
        />
      ) : null}
    </aside>
  );
};

export interface DockActionsLabels {
  maximize: string;
  restore: string;
  close: string;
}

/** Maximize and close, for the host to place in the panel's header. */
export const DockActions = ({
  mode,
  onModeChange,
  labels,
}: {
  mode: DockMode;
  onModeChange: (mode: DockMode) => void;
  labels: DockActionsLabels;
}) => {
  const maximized = mode === "maximized";
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        aria-label={maximized ? labels.restore : labels.maximize}
        aria-pressed={maximized}
        isIconOnly
        onPress={() => onModeChange(maximized ? "open" : "maximized")}
        size="sm"
        variant="ghost"
        className="size-6 shrink-0">
        {maximized ? (
          <Minimize2 className="size-3.5" />
        ) : (
          <Maximize2 className="size-3.5" />
        )}
      </Button>
      <Button
        aria-label={labels.close}
        isIconOnly
        onPress={() => onModeChange("closed")}
        size="sm"
        variant="ghost"
        className="size-6 shrink-0">
        <X className="size-3.5" />
      </Button>
    </div>
  );
};
