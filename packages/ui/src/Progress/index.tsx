"use client";

import * as React from "react";

import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "../utils";

const Progress = ({
  className,
  value,
  ref,
  ...props
}: React.ComponentPropsWithRef<typeof ProgressPrimitive.Root>) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "c-bg-gradient-yellow-to-pink relative h-4 w-full overflow-hidden rounded-full",
      className
    )}
    {...props}>
    <ProgressPrimitive.Indicator
      className="c-bg-gradient-purple-to-pink size-full flex-1 transition-all"
      style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
    />
  </ProgressPrimitive.Root>
);

export { Progress };
