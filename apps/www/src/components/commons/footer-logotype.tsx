"use client";

import { useId } from "react";
import type { MouseEvent } from "react";

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";

const CELL = 32;
const GAP = 1;
const ROWS = 8;

/** "Chia1104" set on a `ROWS`-row grid; `#` is a filled cell. */
const GLYPHS = [
  [".###.", "#...#", "#....", "#....", "#....", "#....", "#...#", ".###."],
  ["#....", "#....", "####.", "#...#", "#...#", "#...#", "#...#", "#...#"],
  [".#", "..", "##", ".#", ".#", ".#", ".#", ".#"],
  ["....", "....", ".####", "#...#", "#...#", "#...#", "#..##", ".##.#"],
  [".#.", "##.", ".#.", ".#.", ".#.", ".#.", ".#.", "###"],
  [".#.", "##.", ".#.", ".#.", ".#.", ".#.", ".#.", "###"],
  [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", "#...#", ".###."],
  ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#.", "...#."],
];

const { path: PATH, columns: COLUMNS } = GLYPHS.reduce(
  (acc, rows) => {
    const width = Math.max(...rows.map((row) => row.length));
    rows.forEach((row, y) => {
      [...row].forEach((cell, x) => {
        if (cell === "#") {
          acc.path += `M${(acc.columns + x) * CELL} ${y * CELL}h${CELL}v${CELL}h-${CELL}z`;
        }
      });
    });
    acc.columns += width + GAP;
    return acc;
  },
  { path: "", columns: 0 }
);

const WIDTH = (COLUMNS - GAP) * CELL;
const HEIGHT = ROWS * CELL;

/** The footer's closing wordmark, cropped by the last rule; its ink follows the pointer. */
export const FooterLogotype = () => {
  const gradientId = useId();
  const shouldReduceMotion = useReducedMotion();
  const pointer = useMotionValue(0.5);
  const x1 = useSpring(useTransform(pointer, [0, 1], [0, WIDTH]), {
    stiffness: 150,
    damping: 25,
  });

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (shouldReduceMotion) return;
    const { left, width } = event.currentTarget.getBoundingClientRect();
    pointer.set((event.clientX - left) / width);
  };

  return (
    <div aria-hidden className="rule-b">
      <div
        className="overflow-hidden"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => pointer.set(0.5)}>
        <svg
          className="block w-full translate-y-[37.5%]"
          viewBox={`-1 -1 ${WIDTH + 2} ${HEIGHT + 2}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg">
          <path d={PATH} fill={`url(#${gradientId})`} />
          <path d={PATH} className="stroke-separator" strokeWidth={2} />
          <defs>
            <motion.linearGradient
              id={gradientId}
              x1={x1}
              y1={0}
              x2={WIDTH / 2}
              y2={HEIGHT}
              gradientUnits="userSpaceOnUse">
              <stop
                offset="0.15"
                stopColor="var(--foreground)"
                stopOpacity="0"
              />
              <stop offset="0.4" stopColor="var(--accent)" stopOpacity="0.5" />
              <stop
                offset="0.625"
                stopColor="var(--foreground)"
                stopOpacity="0.9"
              />
            </motion.linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
};
