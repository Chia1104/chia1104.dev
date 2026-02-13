"use client";

import { useEffect } from "react";

import { Theme } from "@chia/ui/theme";
import useTheme from "@chia/ui/utils/use-theme";

import { COLOR_CSS_VAR_MAP, useSettingsStore } from "@/stores/settings/store";
import type { ThemeColors } from "@/stores/settings/store";

export function ThemeVarsSync() {
  const { theme, isDarkMode } = useTheme();
  const themeState = useSettingsStore((s) => s.theme);

  const resolvedMode: typeof Theme.DARK | typeof Theme.LIGHT =
    theme === "system"
      ? isDarkMode
        ? Theme.DARK
        : Theme.LIGHT
      : theme === Theme.DARK
        ? Theme.DARK
        : Theme.LIGHT;

  useEffect(() => {
    if (resolvedMode !== Theme.LIGHT && resolvedMode !== Theme.DARK) return;

    const colors = themeState[resolvedMode]?.colors;
    const root = document.documentElement;

    (Object.keys(COLOR_CSS_VAR_MAP) as (keyof ThemeColors)[]).forEach((key) => {
      const value = colors?.[key];
      const cssVar = COLOR_CSS_VAR_MAP[key];
      if (value) {
        root.style.setProperty(cssVar, value);
      } else {
        root.style.removeProperty(cssVar);
      }
    });
  }, [resolvedMode, themeState]);

  return null;
}
