"use client";

import { useEffect, useState } from "react";
import type { ComponentProps } from "react";

import { NoiseBackground } from "@chia/shaders/noise-background";
import useTheme from "@chia/ui/utils/use-theme";

import { readAccentGradient } from "@/libs/palette";
import { useSettingsStore } from "@/stores/settings/store";

/** Until the stops resolve, the glows stay invisible instead of flashing the shader's defaults. */
const UNRESOLVED = ["transparent", "transparent"] as const;

/** NoiseBackground lit by the accent gradient, following the mode on screen and the reader's palette. */
export const AccentNoiseBackground = (
  props: Omit<ComponentProps<typeof NoiseBackground>, "gradientColors">
) => {
  const { isDarkMode } = useTheme();
  const palette = useSettingsStore((state) => state.palette);
  const [colors, setColors] = useState<readonly [string, string]>(UNRESOLVED);

  useEffect(() => {
    // The mode class and the palette sheet land in the same commit as this render; read after it.
    const frame = requestAnimationFrame(() =>
      setColors(readAccentGradient() ?? UNRESOLVED)
    );
    return () => cancelAnimationFrame(frame);
  }, [isDarkMode, palette]);

  return (
    <NoiseBackground
      {...props}
      gradientColors={{ light: colors, dark: colors }}
    />
  );
};
