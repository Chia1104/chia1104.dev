"use client";

import type { FC, ComponentProps, ReactNode } from "react";
import { useRef } from "react";

import { motion, useInView } from "framer-motion";
import type { HTMLMotionProps, ForwardRefComponent } from "framer-motion";

import { cn } from "../utils";

type FadeInProps = Omit<
  ComponentProps<ForwardRefComponent<HTMLSpanElement, HTMLMotionProps<"span">>>,
  "children"
> & {
  children?: ReactNode | ((isInView: boolean) => ReactNode);
};

const FadeIn: FC<FadeInProps> = ({ className, children, ...props }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref);
  return (
    <motion.span
      ref={ref}
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
      {typeof children === "function" ? children(isInView) : children}
    </motion.span>
  );
};

export default FadeIn;
