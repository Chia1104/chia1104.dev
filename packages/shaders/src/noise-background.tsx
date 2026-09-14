"use client";

import { useState } from "react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import {
  Circle,
  FilmGrain,
  FlowField,
  LinearGradient,
  RoundedRect,
  Shader,
  SolidColor,
} from "shaders/react";

import { cn } from "@chia/ui/utils/cn.util";

import useShaderEnvironment from "./utils/use-shader-environment";

type GradientColors = readonly [string, string, string];

/** Matches the container's `bg-neutral-200 dark:bg-neutral-900/90`, which shows until the shader is ready. */
const BASE_COLOR = {
  light: "oklch(92.2% 0 0)",
  dark: "oklch(20.5% 0 0 / 0.9)",
};

const DEFAULT_GRADIENT_COLORS: GradientColors = [
  "rgb(255, 100, 150)",
  "rgb(100, 150, 255)",
  "rgb(255, 200, 100)",
];

const px = (value: number) => ({ value, unit: "px" as const });

interface NoiseBackgroundProps extends ComponentPropsWithoutRef<"div"> {
  children?: ReactNode;
  containerClassName?: string;
  gradientColors?: { light: GradientColors; dark?: GradientColors };
  gradientLayerOpacity?: { first?: number; second?: number };
  /** FilmGrain strength; dark surfaces show grain far more, so each theme has its own. */
  noiseIntensity?: { light?: number; dark?: number };
  /** FlowField speed that carries the glow and the top highlight around. */
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
      className={cn(
        "group relative overflow-hidden rounded-3xl",
        status === "ready"
          ? "bg-transparent"
          : "bg-neutral-200 dark:bg-neutral-900/90",
        "shadow-[0px_0.5px_1px_0px_var(--color-neutral-400)_inset,0px_1px_0px_0px_var(--color-neutral-100)]",
        "dark:shadow-[0px_1px_0px_0px_var(--color-neutral-950)_inset,0px_1px_0px_0px_var(--color-neutral-800)]",
        containerClassName
      )}>
      {canRender && status !== "unavailable" ? (
        <Shader
          aria-hidden
          className="pointer-events-none absolute inset-0 size-full"
          onReady={() => setStatus("ready")}
          onUnavailable={() => setStatus("unavailable")}>
          {/* The base sits inside the flow so its render target stays opaque; soft edges over a
              transparent target lose their color when the flow resamples them. */}
          <FlowField
            strength={0.25}
            detail={0.5}
            speed={flowSpeed}
            evolutionSpeed={flowSpeed}>
            <SolidColor
              color={isDarkMode ? BASE_COLOR.dark : BASE_COLOR.light}
            />
            <Circle
              center={{ x: 0.35, y: 0.4 }}
              radius={1.1}
              softness={1}
              color={colors[0]}
              opacity={gradientLayerOpacity?.first ?? 0.4}
            />
            <Circle
              center={{ x: 0.7, y: 0.65 }}
              radius={1.1}
              softness={1}
              color={colors[1]}
              opacity={gradientLayerOpacity?.second ?? 0.3}
            />
          </FlowField>
          <RoundedRect
            id="noise-top-highlight"
            visible={false}
            origin="top-left"
            center={{ x: 0, y: px(2) }}
            width={1}
            height={px(2)}
            rounding={0}
            softness={0.01}
          />
          <FlowField
            maskSource="noise-top-highlight"
            opacity={0.8}
            strength={0.3}
            speed={flowSpeed}
            evolutionSpeed={flowSpeed}>
            <LinearGradient
              stops={colors.map((color, index) => ({
                color,
                position: index / (colors.length - 1),
              }))}
              colorSpace="oklab"
            />
          </FlowField>
          <FilmGrain
            strength={
              isDarkMode
                ? (noiseIntensity?.dark ?? 0.05)
                : (noiseIntensity?.light ?? 0.3)
            }
            bias={0}
          />
        </Shader>
      ) : null}
      <div className={cn("relative z-10", className)}>{children}</div>
    </div>
  );
};
