"use client";

import { useTheme } from "next-themes";
import { useMediaQuery } from "usehooks-ts";

interface Restult extends ReturnType<typeof useTheme> {
  /**
   * is useful to know if the user has dark mode enabled
   */
  isDarkMode: boolean;
}

const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)";

export default function useDarkMode(): Restult {
  const { theme, ...rest } = useTheme();
  // select color-scheme from `style="color-scheme: dark;"` in html tag
  const isDarkOS = useMediaQuery(COLOR_SCHEME_QUERY);

  return {
    isDarkMode: theme === "system" ? isDarkOS : theme === "dark",
    theme,
    ...rest,
  };
}
