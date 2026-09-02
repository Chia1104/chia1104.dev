"use client";

import dynamic from "next/dynamic";

import { motion } from "motion/react";

import useDarkMode from "@chia/ui/utils/use-theme";

const Bot = dynamic(() => import("@chia/shaders/bot").then((mod) => mod.Bot), {
  ssr: false,
});

/** The animated mascot; the host decides what pressing it does. */
export const CHBot = (props: React.ComponentProps<typeof Bot>) => {
  const { isDarkMode } = useDarkMode();

  return (
    <motion.span
      animate={{ scale: [1, 1.04, 1] }}
      transition={{
        duration: 2.5,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      className="inline-block">
      <Bot
        solidColorProps={{ color: isDarkMode ? "#08071a" : "#ffffff" }}
        {...props}
      />
    </motion.span>
  );
};
