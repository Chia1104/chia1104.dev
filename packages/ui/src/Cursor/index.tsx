"use client";

import { useEffect, useState, type FC, type ComponentProps } from "react";
import {
  motion,
  type HTMLMotionProps,
  type ForwardRefComponent,
  type MotionStyle,
} from "framer-motion";
import { cn } from "../utils";

const Cursor: FC<
  ComponentProps<ForwardRefComponent<HTMLDivElement, HTMLMotionProps<"div">>>
> = ({ style, className, transition, ...props }) => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const updateMousePosition = (e: MouseEvent) => {
      setMousePosition({
        x: e.clientX,
        y: e.clientY,
      });
    };

    window.addEventListener("mousemove", updateMousePosition);

    return () => {
      window.removeEventListener("mousemove", updateMousePosition);
    };
  }, []);

  const variants = {
    default: {
      x: mousePosition.x - 200,
      y: mousePosition.y - 200,
    },
  };

  const makeStyle = (style?: MotionStyle) => {
    return {
      transform: "translate(-50%, -50%)",
      filter: "blur(20px)",
      opacity: 0.4,
      zIndex: -1,
      ...style,
    };
  };

  return (
    <motion.div
      className={cn(
        "c-bg-gradient-yellow-to-pink dark:c-bg-gradient-purple-to-pink fixed left-0 top-0 size-[400px] rounded-full",
        className
      )}
      style={makeStyle(style)}
      animate="default"
      variants={variants}
      transition={{ ease: "linear", duration: 0.1, ...transition }}
      {...props}
    />
  );
};

export default Cursor;
