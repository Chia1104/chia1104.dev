"use client";

import { lazy, Suspense, useRef, useState } from "react";
import type { ComponentPropsWithoutRef, ReactNode, RefObject } from "react";

import { useResizeObserver } from "usehooks-ts";

import { cn } from "@chia/ui/utils/cn.util";

import useShaderEnvironment from "./utils/use-shader-environment";

/** A static import would put the whole shader runtime in the initial scripts of every page that renders this. */
const NoiseBackgroundLayer = lazy(() => import("./noise-background-layer"));

type GradientColors = readonly [string, string];

/** Matches the container's `bg-neutral-200 dark:bg-neutral-900/90`, which shows until the shader is ready. */
const BASE_COLOR = {
  light: "oklch(92.2% 0 0)",
  dark: "oklch(20.5% 0 0)",
};

const DEFAULT_GRADIENT_COLORS: GradientColors = [
  "rgb(255, 100, 150)",
  "rgb(100, 150, 255)",
];

/**
 * Glow radius in canvas heights, grown by the square root of a wide container's aspect ratio so the
 * glow scales with width while the frosted base still shows at the edges.
 */
const GLOW_RADIUS = 1.1;

interface NoiseBackgroundProps extends ComponentPropsWithoutRef<"div"> {
  children?: ReactNode;
  containerClassName?: string;
  gradientColors?: { light: GradientColors; dark?: GradientColors };
  gradientLayerOpacity?: { first?: number; second?: number };
  /** FilmGrain strength; dark surfaces show grain far more, so each theme has its own. */
  noiseIntensity?: { light?: number; dark?: number };
  /** FlowField speed that carries the glow around. */
  speed?: number;
  animating?: boolean;
}

export const NoiseBackground = ({
  children,
  className,
  containerClassName,
  gradientColors = { light: DEFAULT_GRADIENT_COLORS },
  gradientLayerOpacity,
  noiseIntensity,
  speed = 1,
  animating = true,
  ...props
}: NoiseBackgroundProps) => {
  const { canRender, isDarkMode, reduceMotion } = useShaderEnvironment();
  const containerRef = useRef<HTMLDivElement>(null);
  const { width = 0, height = 0 } = useResizeObserver({
    ref: /* SAFETY: usehooks-ts types `ref` for React 18; the hook reads `current` only after mount. */ containerRef as RefObject<HTMLDivElement>,
  });
  const glowRadius =
    GLOW_RADIUS * (height > 0 ? Math.sqrt(Math.max(1, width / height)) : 1);
  const [status, setStatus] = useState<"pending" | "ready" | "unavailable">(
    "pending"
  );
  const colors = isDarkMode
    ? (gradientColors.dark ?? gradientColors.light)
    : gradientColors.light;
  const flowSpeed = animating && !reduceMotion ? speed : 0;

  return (
    <div
      {...props}
      ref={containerRef}
      className={cn(
        "group relative overflow-hidden rounded-3xl",
        status === "ready"
          ? "bg-transparent"
          : "bg-neutral-200 dark:bg-neutral-900/90",
        containerClassName
      )}>
      {canRender && status !== "unavailable" ? (
        <Suspense fallback={null}>
          <NoiseBackgroundLayer
            baseColor={isDarkMode ? BASE_COLOR.dark : BASE_COLOR.light}
            colors={colors}
            glowRadius={glowRadius}
            layerOpacity={{
              first: gradientLayerOpacity?.first ?? 0.4,
              second: gradientLayerOpacity?.second ?? 0.3,
            }}
            grain={
              isDarkMode
                ? (noiseIntensity?.dark ?? 0.05)
                : (noiseIntensity?.light ?? 0.3)
            }
            flowSpeed={flowSpeed}
            onReady={() => setStatus("ready")}
            onUnavailable={() => setStatus("unavailable")}
          />
        </Suspense>
      ) : null}
      <div className={cn("relative z-10", className)}>{children}</div>
    </div>
  );
};
