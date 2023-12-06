"use client";

import {
  motion,
  useScroll,
  useSpring,
  type HTMLMotionProps,
  type ForwardRefComponent,
} from "framer-motion";
import { type FC, type ComponentProps } from "react";
import { cn, useDarkMode } from "../utils";

const ScrollYProgress: FC<
  ComponentProps<ForwardRefComponent<HTMLDivElement, HTMLMotionProps<"div">>>
> = ({ className, style, ...rest }) => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  const { isDarkMode } = useDarkMode();

  return (
    <motion.div
      {...rest}
      className={cn(
        "w-full",
        className,
        isDarkMode
          ? "c-bg-gradient-purple-to-pink"
          : "c-bg-gradient-yellow-to-pink"
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
