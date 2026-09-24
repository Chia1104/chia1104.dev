"use client";

import { useTheme } from "next-themes";
import type { UseThemeProps } from "next-themes";
import { useMediaQuery } from "usehooks-ts";

import { isEnumValue } from "@chia/utils/is";

export const Theme = {
  System: "system",
  Dark: "dark",
  Light: "light",
} as const;

export type Theme = (typeof Theme)[keyof typeof Theme];

interface Result extends Omit<UseThemeProps, "theme"> {
  /** `undefined` until the provider has read the stored choice. */
  theme: Theme | undefined;
  isDarkMode: boolean;
}

const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)";

export default function useDarkMode(): Result {
  const { theme: stored, ...rest } = useTheme();
  const isDarkOS = useMediaQuery(COLOR_SCHEME_QUERY);
  const theme =
    stored !== undefined && isEnumValue(Theme, stored) ? stored : undefined;

  return {
    isDarkMode: theme === Theme.System ? isDarkOS : theme === Theme.Dark,
    theme,
    ...rest,
  };
}
