"use client";

import { useCallback } from "react";
import type { FC, ComponentProps } from "react";
import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";
import type { HTMLMotionProps, ForwardRefComponent } from "framer-motion";
import { cn } from "../utils";
import { useEventListener } from "usehooks-ts";

const Cursor: FC<
  ComponentProps<ForwardRefComponent<HTMLDivElement, HTMLMotionProps<"div">>>
> = ({ style, className, ...props }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, {
    stiffness: 300,
    damping: 40,
  });
  const springY = useSpring(y, {
    stiffness: 300,
    damping: 40,
  });

  const updateMousePosition = useCallback(
    (e: MouseEvent) => {
      springX.set(e.clientX);
      springY.set(e.clientY);
    },
    [springX, springY]
  );

  useEventListener("mousemove", updateMousePosition);

  const transformX = useTransform(springX, (value) => value - 200);
  const transformY = useTransform(springY, (value) => value - 200);
  return (
    <motion.div
      className={cn(
        "c-bg-gradient-yellow-to-pink dark:c-bg-gradient-purple-to-pink fixed left-0 top-0 size-[400px] rounded-full",
        className
      )}
      style={{
        x: transformX,
        y: transformY,
        transform: "translate(-50%, -50%)",
        filter: "blur(20px)",
        opacity: 0.4,
        zIndex: -1,
        ...style,
      }}
      {...props}
    />
  );
};

export default Cursor;
