"use client";

import type { FC } from "react";
import { useState, useEffect } from "react";

import { useDebouncedCallback } from "@tanstack/react-pacer";

import Spotlight from "@chia/ui/spotlight";
import useTheme from "@chia/ui/utils/use-theme";

import { useSettingsStore } from "@/stores/settings/store";

/** The bright fill waits for the first paint so the spotlight fades in instead of flashing. */
const SPOTLIGHT_DELAY_MS = 500;

const Background: FC = () => {
  const { isDarkMode } = useTheme();
  const backgroundEnabled = useSettingsStore((s) => s.backgroundEnabled);
  const [isOK, setIsOK] = useState(false);

  const reveal = useDebouncedCallback(() => setIsOK(true), {
    wait: SPOTLIGHT_DELAY_MS,
  });
  useEffect(() => {
    reveal();
  }, [reveal]);

  if (!backgroundEnabled) {
    return null;
  }

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
