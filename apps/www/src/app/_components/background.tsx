"use client";

import type { FC } from "react";

import { Spotlight, useTheme, useIsMounted } from "@chia/ui";

const Background: FC = () => {
  const { isDarkMode } = useTheme();
  const isMounted = useIsMounted();
  return (
    <>
      <Spotlight
        className="fixed -top-40 left-0 -z-40 md:-top-20 md:left-60"
        fill={
          isDarkMode && isMounted
            ? "rgba(255, 255, 255, 0.7)"
            : "rgba(0, 0, 0, 0.5)"
        }
      />
      <div className="c-background" />
    </>
  );
};

export default Background;
