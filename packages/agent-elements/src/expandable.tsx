"use client";

import type { ReactNode } from "react";
import { useLayoutEffect, useRef, useState } from "react";

import { Button } from "@heroui/react";
import { ChevronDown } from "lucide-react";

import { cn } from "@chia/ui/utils/cn.util";

import { useAgentLabels } from "./labels-context.tsx";

export interface ExpandableProps {
  /** Height the content is clipped to until expanded, in px. */
  maxHeight: number;
  children: ReactNode;
  className?: string;
  /** Applied to the toggle row, e.g. to align it with the content's padding. */
  toggleClassName?: string;
}

/**
 * Clips its content to `maxHeight` and offers to show the rest. Content that fits shows no
 * toggle at all, and one that grows past the limit later — a streaming message — gains it: the
 * overflow is observed, not computed once. Expanding changes the element's height, which the
 * thread's virtualizer re-measures through its own `ResizeObserver`.
 */
export const Expandable = ({
  children,
  className,
  maxHeight,
  toggleClassName,
}: ExpandableProps) => {
  const labels = useAgentLabels();
  const contentRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const measure = () => setOverflows(content.scrollHeight > maxHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, [maxHeight]);

  const clipped = overflows && !expanded;

  return (
    <div className={cn("min-w-0", className)}>
      <div
        className={cn(
          "overflow-hidden",
          clipped &&
            "[mask-image:linear-gradient(to_bottom,black_calc(100%-2.5rem),transparent)]"
        )}
        style={{ maxHeight: expanded ? undefined : maxHeight }}>
        <div ref={contentRef}>{children}</div>
      </div>
      {overflows ? (
        <div className={cn("flex justify-self-end", toggleClassName)}>
          <Button
            aria-expanded={expanded}
            className="text-muted h-6 gap-1 px-1.5 text-xs"
            onPress={() => setExpanded((open) => !open)}
            size="sm"
            variant="ghost">
            {expanded ? labels.showLess : labels.showMore}
            <ChevronDown
              aria-hidden
              className={cn(
                "size-3.5 transition-transform",
                expanded && "rotate-180"
              )}
            />
          </Button>
        </div>
      ) : null}
    </div>
  );
};
