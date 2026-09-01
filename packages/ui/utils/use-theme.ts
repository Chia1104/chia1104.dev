"use client";

import { useTheme } from "next-themes";
import { useMediaQuery } from "usehooks-ts";

interface Result extends ReturnType<typeof useTheme> {
  isDarkMode: boolean;
}

const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)";

export default function useDarkMode(): Result {
  const { theme, ...rest } = useTheme();
  const isDarkOS = useMediaQuery(COLOR_SCHEME_QUERY);

  return {
    isDarkMode: theme === "system" ? isDarkOS : theme === "dark",
    theme,
    ...rest,
  };
}
