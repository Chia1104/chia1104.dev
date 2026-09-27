"use client";

import dynamic from "next/dynamic";

import { useReducedMotion } from "motion/react";

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

  return (
    // CSS keeps the breathing on the compositor instead of the main thread.
    <span
      className={cn("inline-flex", !resting && "motion-safe:animate-breathe")}>
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
    </span>
  );
};
