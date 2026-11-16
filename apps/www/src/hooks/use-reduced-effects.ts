"use client";

import { useCanHover } from "@/hooks/use-can-hover";
import { useSettingsStore } from "@/stores/settings/store";

/**
 * Whether the hobby mode's effects hold still: the reader's choice, and until they make one, on
 * for touch devices, where a full-screen shader costs the most and has no pointer to follow.
 */
export const useReducedEffects = () => {
  const preference = useSettingsStore((state) => state.reducedEffects);
  const canHover = useCanHover();
  return preference ?? !canHover;
};
