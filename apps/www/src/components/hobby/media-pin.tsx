"use client";

import { useEffect } from "react";

import { useHobbyStore } from "@/stores/hobby/store";
import type { HobbyPin } from "@/stores/hobby/store";

/** Hands the stage one work's colour for as long as its page or sheet is mounted. */
export const MediaPin = ({ color, coversStage }: HobbyPin) => {
  const setPinned = useHobbyStore((state) => state.setPinned);

  useEffect(() => {
    setPinned({ color, coversStage });
    return () => setPinned(null);
  }, [color, coversStage, setPinned]);

  return null;
};
