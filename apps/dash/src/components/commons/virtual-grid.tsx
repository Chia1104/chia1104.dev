"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { useWindowVirtualizer } from "@tanstack/react-virtual";

import { cn } from "@chia/ui/utils/cn.util";

/** Matches `gap-5`, which the callers use between columns. */
const ROW_GAP = 20;

/**
 * A card grid that mounts only the rows near the viewport; the page itself scrolls. The column
 * count stays with CSS: `className` carries the grid classes, container queries included, and
 * the count is read back off an empty grid that wears them.
 */
export const VirtualGrid = <TItem,>({
  items,
  getKey,
  className,
  estimateRowSize,
  children,
}: {
  items: readonly TItem[];
  getKey: (item: TItem) => string | number;
  /** Column classes, e.g. `page-md:grid-cols-2 grid-cols-1 gap-5`. */
  className: string;
  /** A row's height before it is measured. */
  estimateRowSize: number;
  children: (item: TItem, index: number) => ReactNode;
}) => {
  // The virtualizer is one stable object whose answers change as the page scrolls; compiled
  // memoization would keep the rows it returned first.
  "use no memo";
  const probe = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(1);
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    const element = probe.current;
    if (!element) return;
    const measure = () => {
      const tracks = getComputedStyle(element)
        .gridTemplateColumns.split(" ")
        .filter(Boolean).length;
      setColumns(Math.max(1, tracks));
      setScrollMargin(element.getBoundingClientRect().top + window.scrollY);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const virtualizer = useWindowVirtualizer({
    count: Math.ceil(items.length / columns),
    estimateSize: () => estimateRowSize,
    gap: ROW_GAP,
    overscan: 3,
    scrollMargin,
    getItemKey: (index) => {
      const first = items[index * columns];
      return first === undefined ? index : getKey(first);
    },
  });

  // Rows hold other items once the column count changes, so their measured heights are stale.
  useEffect(() => virtualizer.measure(), [columns, virtualizer]);

  return (
    <div className="w-full">
      <div ref={probe} aria-hidden className={cn("grid h-0", className)} />
      <div
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((row) => (
          <div
            key={row.key}
            ref={virtualizer.measureElement}
            className={cn("absolute top-0 left-0 grid w-full", className)}
            data-index={row.index}
            style={{
              transform: `translateY(${row.start - virtualizer.options.scrollMargin}px)`,
            }}>
            {items
              .slice(row.index * columns, (row.index + 1) * columns)
              .map((item, offset) =>
                children(item, row.index * columns + offset)
              )}
          </div>
        ))}
      </div>
    </div>
  );
};
