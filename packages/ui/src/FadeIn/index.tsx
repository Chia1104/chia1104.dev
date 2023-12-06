"use client";

import { type FC, type ComponentProps } from "react";
import {
  motion,
  type HTMLMotionProps,
  type ForwardRefComponent,
} from "framer-motion";
import { cn } from "../utils";

interface FadeInProps
  extends ComponentProps<
    ForwardRefComponent<HTMLSpanElement, HTMLMotionProps<"span">>
  > {}

const FadeIn: FC<FadeInProps> = ({ className, children, ...props }) => {
  return (
    <motion.span
      className={cn("flex w-fit", className)}
      whileInView={{
        opacity: 1,
        y: 0,
        transition: {
          duration: 0.5,
        },
      }}
      initial={{
        opacity: 0,
        y: 20,
      }}
      {...props}>
      {children}
    </motion.span>
  );
};

export default FadeIn;
