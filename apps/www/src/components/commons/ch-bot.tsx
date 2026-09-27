"use client";

import dynamic from "next/dynamic";

import { motion, useReducedMotion } from "motion/react";

import { cn } from "@chia/ui/utils/cn.util";
import { useIdle } from "@chia/ui/utils/use-idle";
import useDarkMode from "@chia/ui/utils/use-theme";

/** Mounted once the page is idle: the shader runtime is megabytes of script, and the header shows this on every page. */
const Bot = dynamic(() => import("@chia/shaders/bot").then((mod) => mod.Bot), {
  ssr: false,
});

/** The animated mascot; the host decides what pressing it does. */
export const CHBot = ({
  resting = false,
  ...props
}: React.ComponentProps<typeof Bot> & { resting?: boolean }) => {
  const { isDarkMode } = useDarkMode();
  const reducedMotion = useReducedMotion();
  const isIdle = useIdle();
  const breathe = !resting && !reducedMotion;

  return (
    <motion.span
      animate={{ scale: breathe ? [1, 1.04, 1] : 1 }}
      transition={{
        duration: reducedMotion ? 0 : breathe ? 2.5 : 0.2,
        repeat: breathe ? Infinity : 0,
        ease: "easeInOut",
      }}
      className="inline-flex">
      {isIdle ? (
        <Bot
          solidColorProps={{ color: isDarkMode ? "#08071a" : "#ffffff" }}
          {...props}
          blobsProps={
            reducedMotion || resting
              ? {
                  alpha: {
                    ...props.blobsProps?.alpha,
                    speed: reducedMotion ? 0 : 0.2,
                  },
                  beta: {
                    ...props.blobsProps?.beta,
                    speed: reducedMotion ? 0 : 0.2,
                  },
                  gamma: {
                    ...props.blobsProps?.gamma,
                    speed: reducedMotion ? 0 : 0.2,
                  },
                }
              : props.blobsProps
          }
          chromaFlowProps={
            reducedMotion
              ? { ...props.chromaFlowProps, visible: false }
              : props.chromaFlowProps
          }
        />
      ) : (
        <span className={cn("bg-default size-25", props.className)} />
      )}
    </motion.span>
  );
};
