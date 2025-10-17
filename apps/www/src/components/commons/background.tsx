"use client";

import type { FC } from "react";
import { useState, useEffect } from "react";

import Spotlight from "@chia/ui/spotlight";
import useTheme from "@chia/ui/utils/use-theme";

const Background: FC = () => {
  const [isOK, setIsOK] = useState(false);
  const { isDarkMode } = useTheme();
  useEffect(() => {
    const id = setInterval(() => {
      setIsOK(true);
    }, 500);
    return () => clearInterval(id);
  }, []);
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
