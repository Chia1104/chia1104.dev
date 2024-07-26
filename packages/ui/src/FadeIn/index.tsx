"use client";

import type { FC, ComponentProps } from "react";

import { motion } from "framer-motion";
import type { HTMLMotionProps, ForwardRefComponent } from "framer-motion";

import { cn } from "../utils";

type FadeInProps = ComponentProps<
  ForwardRefComponent<HTMLSpanElement, HTMLMotionProps<"span">>
>;

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
