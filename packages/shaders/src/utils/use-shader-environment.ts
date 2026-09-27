"use client";

import { useSyncExternalStore } from "react";

import { useHydrated } from "@chia/ui/utils/use-hydrated";
import { useIdle } from "@chia/ui/utils/use-idle";
import useTheme, { Theme } from "@chia/ui/utils/use-theme";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const subscribeReducedMotion = (onChange: () => void) => {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

// Nothing to subscribe to: hydration is the only transition.
/**
 * Theme and motion inputs for a shader. `canRender` stays false until hydration, because the
 * server knows no theme and a shader painted with the wrong palette would flash, and until the
 * page is idle, because the shader runtime is megabytes of script.
 */
const useShaderEnvironment = () => {
  const { resolvedTheme } = useTheme();
  const isHydrated = useHydrated();
  const isIdle = useIdle();
  const reduceMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false
  );
  return {
    canRender: isHydrated && isIdle && !!resolvedTheme,
    isDarkMode: resolvedTheme === Theme.Dark,
    reduceMotion,
  };
};

export default useShaderEnvironment;
