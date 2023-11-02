"use client";

import {
  motion,
  useScroll,
  useSpring,
  type HTMLMotionProps,
  type ForwardRefComponent,
} from "framer-motion";
import React, { type FC, type ComponentProps } from "react";
import { cn } from "../utils";

const ScrollYProgress: FC<
  ComponentProps<ForwardRefComponent<HTMLDivElement, HTMLMotionProps<"div">>>
> = ({ className, style, ...rest }) => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <motion.div
      {...rest}
      className={cn("bg-secondary w-full", className)}
      style={{
        scaleX,
        height: "5px",
        transform: "rotate(-90deg)",
        ...style,
      }}
    />
  );
};

export default ScrollYProgress;
