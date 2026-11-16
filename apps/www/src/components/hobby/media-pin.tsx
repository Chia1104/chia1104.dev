"use client";

import { useEffect } from "react";

import { useHobbyStore } from "@/stores/hobby/store";
import type { HobbyPin } from "@/stores/hobby/store";

/**
 * Hands the stage one work's colour for as long as its page or sheet is mounted. The surface
 * shows the work's own art, so the stage is only held or covered.
 */
export const MediaPin = ({
  color,
  stage,
}: Pick<HobbyPin, "color" | "stage">) => {
  const setPinned = useHobbyStore((state) => state.setPinned);

  useEffect(() => {
    setPinned({ color, backdropUrl: null, stage });
    return () => setPinned(null);
  }, [color, stage, setPinned]);

  return null;
};
