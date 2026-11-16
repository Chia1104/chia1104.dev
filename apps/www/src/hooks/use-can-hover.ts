"use client";

import { useSyncExternalStore } from "react";

const HOVER_QUERY = "(hover: hover)";

const subscribe = (onChange: () => void) => {
  const query = window.matchMedia(HOVER_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

/** Whether the primary input can hover: false on phones and tablets. The server assumes it can. */
export const useCanHover = () =>
  useSyncExternalStore(
    subscribe,
    () => window.matchMedia(HOVER_QUERY).matches,
    () => true
  );
