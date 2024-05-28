"use client";

import { motion, useScroll, useSpring } from "framer-motion";
import type { HTMLMotionProps, ForwardRefComponent } from "framer-motion";
import type { FC, ComponentProps } from "react";
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
      className={cn(
        "dark:c-bg-gradient-purple-to-pink c-bg-gradient-yellow-to-pink w-full",
        className
      )}
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
