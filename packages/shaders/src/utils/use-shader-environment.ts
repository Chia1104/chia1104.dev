"use client";

import { useSyncExternalStore } from "react";

import { useHydrated } from "@chia/ui/utils/use-hydrated";
import useTheme from "@chia/ui/utils/use-theme";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const subscribeReducedMotion = (onChange: () => void) => {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

// Nothing to subscribe to: hydration is the only transition.
/**
 * Theme and motion inputs for a shader. `canRender` stays false until hydration, because the
 * server knows no theme and a shader painted with the wrong palette would flash.
 */
const useShaderEnvironment = () => {
  const { resolvedTheme } = useTheme();
  const isHydrated = useHydrated();
  const reduceMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false
  );
  return {
    canRender: isHydrated && !!resolvedTheme,
    isDarkMode: resolvedTheme === "dark",
    reduceMotion,
  };
};

export default useShaderEnvironment;
