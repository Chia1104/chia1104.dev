"use client";

import {
  motion,
  useMotionTemplate,
  useMotionValue,
  type MotionStyle,
  type MotionValue,
  type HTMLMotionProps,
  type ForwardRefComponent,
} from "framer-motion";
import React, {
  type MouseEvent,
  type ComponentPropsWithoutRef,
  type FC,
} from "react";
import { cn } from "../utils";

interface Props
  extends ComponentPropsWithoutRef<
    ForwardRefComponent<HTMLDivElement, HTMLMotionProps<"div">>
  > {
  wrapperProps?: ComponentPropsWithoutRef<
    ForwardRefComponent<HTMLDivElement, HTMLMotionProps<"div">>
  >;
}

type WrapperStyle = MotionStyle & {
  "--x": MotionValue<string>;
  "--y": MotionValue<string>;
};

const Card: FC<Props> = ({ className, children, wrapperProps, ...props }) => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  function handleMouseMove({ currentTarget, clientX, clientY }: MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  return (
    <motion.div
      {...wrapperProps}
      className={cn(
        "animated-feature-cards relative w-full drop-shadow-[0_0_15px_rgba(49,49,49,0.2)] dark:drop-shadow-[0_0_15px_rgba(49,49,49,0.2)]",
        wrapperProps?.className
      )}
      style={
        {
          "--x": useMotionTemplate`${mouseX}px`,
          "--y": useMotionTemplate`${mouseY}px`,
          ...wrapperProps?.style,
        } as WrapperStyle
      }
      onMouseMove={handleMouseMove}>
      <motion.div
        className={cn(
          "dark:border-dark group relative w-full overflow-hidden rounded-3xl border bg-gradient-to-b from-neutral-50/90 to-neutral-100/90 transition duration-300 dark:from-neutral-950/90 dark:to-neutral-800/90",
          "md:hover:border-transparent",
          className
        )}
        {...props}>
        {children}
      </motion.div>
    </motion.div>
  );
};

export default Card;
