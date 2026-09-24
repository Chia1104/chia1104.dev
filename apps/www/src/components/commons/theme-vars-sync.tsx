"use client";

import { useEffect } from "react";

import useTheme, { Theme } from "@chia/ui/utils/use-theme";

import { COLOR_CSS_VAR_MAP, useSettingsStore } from "@/stores/settings/store";

export function ThemeVarsSync() {
  const { theme, isDarkMode } = useTheme();
  const themeState = useSettingsStore((s) => s.theme);

  const resolvedMode: typeof Theme.Dark | typeof Theme.Light =
    theme === Theme.System
      ? isDarkMode
        ? Theme.Dark
        : Theme.Light
      : theme === Theme.Dark
        ? Theme.Dark
        : Theme.Light;

  useEffect(() => {
    if (resolvedMode !== Theme.Light && resolvedMode !== Theme.Dark) return;

    const colors = new Map(
      Object.entries(themeState[resolvedMode]?.colors ?? {})
    );
    const root = document.documentElement;

    Object.entries(COLOR_CSS_VAR_MAP).forEach(([key, cssVar]) => {
      const value = colors.get(key);
      if (value) {
        root.style.setProperty(cssVar, value);
      } else {
        root.style.removeProperty(cssVar);
      }
    });
  }, [resolvedMode, themeState]);

  return null;
}
