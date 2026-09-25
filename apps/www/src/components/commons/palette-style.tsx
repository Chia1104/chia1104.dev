"use client";

import { useEffect } from "react";

import {
  PALETTE_STYLE_ID,
  PaletteToken,
  writePaletteStyle,
} from "@/libs/palette";
import { useSettingsStore } from "@/stores/settings/store";

const TOKENS = Object.values(PaletteToken);

/** Keeps the palette `<style>` in step with the store once the pre-paint script has run. */
export const PaletteStyle = () => {
  const palette = useSettingsStore((state) => state.palette);
  useEffect(() => {
    writePaletteStyle(palette, PALETTE_STYLE_ID, TOKENS);
  }, [palette]);
  return null;
};
