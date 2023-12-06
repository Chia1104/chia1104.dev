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
      width: "400px",
      height: "400px",
      filter: "blur(20px)",
      borderRadius: "9999px",
      backgroundColor: "rgb(255, 67, 75)",
      background: "linear-gradient(#43d9ad, #4d5bce)",
      opacity: 0.4,
      zIndex: -1,
      ...style,
    };
  };

  return (
    <motion.div
      className={cn("fixed left-0 top-0", className)}
      style={makeStyle(style)}
      animate="default"
      variants={variants}
      transition={{ ease: "linear", duration: 0.1, ...transition }}
      {...props}
    />
  );
};

export default Cursor;
