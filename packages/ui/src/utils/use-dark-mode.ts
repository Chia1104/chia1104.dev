"use client";

import { useEffect } from "react";

import { useTheme } from "next-themes";
import { useMediaQuery } from "usehooks-ts";

const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)";

interface UseDarkModeOutput {
  isDarkMode: boolean;
  theme: string | undefined;
  toggle: () => void;
  enable: () => void;
  disable: () => void;
}

/**
 * @deprecated use `useTheme`
 */
export default function useDarkMode(): UseDarkModeOutput {
  const isDarkOS = useMediaQuery(COLOR_SCHEME_QUERY);
  const { theme, setTheme } = useTheme();
  const systemTheme = isDarkOS ? "dark" : "light";
  const localTheme = theme === "dark" ? "dark" : "light";

  useEffect(() => {
    setTheme(!theme ? systemTheme : localTheme);
  }, [systemTheme]);

  return {
    isDarkMode: theme === "dark",
    theme,
    toggle: () => setTheme(theme === "dark" ? "light" : "dark"),
    enable: () => setTheme("dark"),
    disable: () => setTheme("light"),
  };
}
