"use client";

import type { FC } from "react";
import { useState, useEffect } from "react";

import { useIsMounted } from "usehooks-ts";

import Spotlight from "@chia/ui/spotlight";
import useTheme from "@chia/ui/utils/use-theme";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const Background: FC = () => {
  const { isDarkMode } = useTheme();
  const isMounted = useIsMounted();
  const [isOK, setIsOK] = useState(false);

  useEffect(() => {
    void delay(500).then(() => isMounted() && setIsOK(true));
  }, [isMounted]);

  return (
    <>
      <Spotlight
        className="fixed -top-40 left-0 -z-40 md:-top-20 md:left-60"
        fill={
          isDarkMode && isOK ? "rgba(255, 255, 255, 0.7)" : "rgba(0, 0, 0, 0.5)"
        }
      />
      <div className="c-background" />
    </>
  );
};

export default Background;
