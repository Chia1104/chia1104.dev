"use client";

import type { ComponentProps, PointerEvent } from "react";

import { Card } from "@heroui/react";

import { cn } from "@chia/ui/utils/cn.util";

export const FeatureCard = ({
  className,
  classNames,
  ...props
}: ComponentProps<typeof Card> & {
  classNames?: {
    card?: string;
    root?: string;
  };
}) => (
  <div
    className={cn(
      "animated-feature-cards relative w-full drop-shadow-[0_0_15px_rgba(49,49,49,0.2)]",
      classNames?.root
    )}
    onPointerMove={(event: PointerEvent<HTMLDivElement>) => {
      const { left, top } = event.currentTarget.getBoundingClientRect();
      event.currentTarget.style.setProperty("--x", `${event.clientX - left}px`);
      event.currentTarget.style.setProperty("--y", `${event.clientY - top}px`);
    }}>
    <Card
      className={cn(
        "dark:border-dark w-full overflow-hidden rounded-2xl border bg-linear-to-b from-neutral-50/90 to-neutral-100/90 shadow-none transition duration-300 md:hover:border-transparent dark:from-neutral-950/90 dark:to-neutral-800/90",
        className,
        classNames?.card
      )}
      {...props}
    />
  </div>
);
