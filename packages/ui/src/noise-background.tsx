"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties, ComponentPropsWithoutRef } from "react";

import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useMotionValueEvent,
  useSpring,
  useTransform,
} from "motion/react";

import { cn } from "../utils/cn.util";

const DEFAULT_GRADIENT_COLORS = [
  "rgb(255, 100, 150)",
  "rgb(100, 150, 255)",
  "rgb(255, 200, 100)",
] as const;

function syncLayerPositionVars(
  container: HTMLDivElement | null,
  springX: { get: () => number },
  springY: { get: () => number }
) {
  if (!container) return;
  const sx = springX.get();
  const sy = springY.get();
  container.style.setProperty("--noise-layer-1-x", `${sx}px`);
  container.style.setProperty("--noise-layer-1-y", `${sy}px`);
  container.style.setProperty("--noise-layer-2-x", `${sx * 0.7}px`);
  container.style.setProperty("--noise-layer-2-y", `${sy * 0.7}px`);
}

const LAYER_1_BG =
  "[background:radial-gradient(circle_at_var(--noise-layer-1-x)_var(--noise-layer-1-y),var(--noise-gradient-1)_0%,transparent_50%)] dark:[background:radial-gradient(circle_at_var(--noise-layer-1-x)_var(--noise-layer-1-y),var(--noise-gradient-1-dark)_0%,transparent_50%)]";
const LAYER_2_BG =
  "[background:radial-gradient(circle_at_var(--noise-layer-2-x)_var(--noise-layer-2-y),var(--noise-gradient-2)_0%,transparent_50%)] dark:[background:radial-gradient(circle_at_var(--noise-layer-2-x)_var(--noise-layer-2-y),var(--noise-gradient-2-dark)_0%,transparent_50%)]";

function GradientLayer({ layer }: { layer: 1 | 2 }) {
  return (
    <div
      className={cn(
        "absolute inset-0",
        layer === 1
          ? "opacity-[var(--noise-layer-1-opacity)]"
          : "opacity-[var(--noise-layer-2-opacity)]",
        layer === 1 ? LAYER_1_BG : LAYER_2_BG
      )}
    />
  );
}

interface NoiseBackgroundProps extends ComponentPropsWithoutRef<"div"> {
  children?: React.ReactNode;
  className?: string;
  containerClassName?: string;
  gradientColors?: [string, string, ...string[]];
  gradientLayerOpacity?: {
    first?: number;
    second?: number;
  };
  noiseIntensity?: number;
  speed?: number;
  backdropBlur?: boolean;
  animating?: boolean;
  springConfig?: {
    stiffness?: number;
    damping?: number;
  };
}

export const NoiseBackground = ({
  children,
  className,
  containerClassName,
  gradientColors = [...DEFAULT_GRADIENT_COLORS],
  gradientLayerOpacity = {
    first: 0.4,
    second: 0.3,
  },
  noiseIntensity = 0.2,
  speed = 0.1,
  backdropBlur = false,
  animating = true,
  springConfig = { stiffness: 100, damping: 30 },
  style,
  ...props
}: NoiseBackgroundProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springX = useSpring(x, {
    stiffness: springConfig.stiffness ?? 100,
    damping: springConfig.damping ?? 30,
  });
  const springY = useSpring(y, {
    stiffness: springConfig.stiffness ?? 100,
    damping: springConfig.damping ?? 30,
  });

  const topGradientX = useTransform(springX, (val) => val * 0.1 - 50);

  const velocityRef = useRef({ x: 0, y: 0 });
  const lastDirectionChangeRef = useRef(0);

  const cssVars = {
    "--noise-opacity": noiseIntensity,
    "--noise-gradient-1": gradientColors[0],
    "--noise-gradient-2": gradientColors[1],
    "--noise-gradient-3": gradientColors[2],
    "--noise-gradient-1-dark": gradientColors[0],
    "--noise-gradient-2-dark": gradientColors[1],
    "--noise-gradient-3-dark": gradientColors[2],
    "--noise-layer-1-opacity": gradientLayerOpacity.first ?? 0.4,
    "--noise-layer-2-opacity": gradientLayerOpacity.second ?? 0.3,
    "--noise-layer-1-x": "0px",
    "--noise-layer-1-y": "0px",
    "--noise-layer-2-x": "0px",
    "--noise-layer-2-y": "0px",
  } as CSSProperties;

  useMotionValueEvent(springX, "change", () => {
    syncLayerPositionVars(containerRef.current, springX, springY);
  });
  useMotionValueEvent(springY, "change", () => {
    syncLayerPositionVars(containerRef.current, springX, springY);
  });

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    x.set(centerX);
    y.set(centerY);
  }, [x, y]);

  const generateRandomVelocityRef = useRef(() => {
    const angle = Math.random() * Math.PI * 2;
    const magnitude = speed * (0.5 + Math.random() * 0.5);
    return {
      x: Math.cos(angle) * magnitude,
      y: Math.sin(angle) * magnitude,
    };
  });

  useEffect(() => {
    generateRandomVelocityRef.current = () => {
      const angle = Math.random() * Math.PI * 2;
      const magnitude = speed * (0.5 + Math.random() * 0.5);
      return {
        x: Math.cos(angle) * magnitude,
        y: Math.sin(angle) * magnitude,
      };
    };
    velocityRef.current = generateRandomVelocityRef.current();
  }, [speed]);

  useAnimationFrame((time) => {
    if (!animating || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const maxX = rect.width;
    const maxY = rect.height;

    if (time - lastDirectionChangeRef.current > 1500 + Math.random() * 1500) {
      velocityRef.current = generateRandomVelocityRef.current();
      lastDirectionChangeRef.current = time;
    }

    const deltaTime = 16;
    const currentX = x.get();
    const currentY = y.get();

    let newX = currentX + velocityRef.current.x * deltaTime;
    let newY = currentY + velocityRef.current.y * deltaTime;

    const padding = 20;

    if (
      newX < padding ||
      newX > maxX - padding ||
      newY < padding ||
      newY > maxY - padding
    ) {
      const angle = Math.random() * Math.PI * 2;
      const magnitude = speed * (0.5 + Math.random() * 0.5);
      velocityRef.current = {
        x: Math.cos(angle) * magnitude,
        y: Math.sin(angle) * magnitude,
      };
      lastDirectionChangeRef.current = time;
      newX = Math.max(padding, Math.min(maxX - padding, newX));
      newY = Math.max(padding, Math.min(maxY - padding, newY));
    }

    x.set(newX);
    y.set(newY);
  });

  return (
    <div
      ref={containerRef}
      {...props}
      style={
        {
          ...cssVars,
          ...style,
        } as CSSProperties
      }
      className={cn(
        "group relative overflow-hidden rounded-2xl bg-neutral-200 backdrop-blur-sm dark:bg-neutral-900/90",
        "shadow-[0px_0.5px_1px_0px_var(--color-neutral-400)_inset,0px_1px_0px_0px_var(--color-neutral-100)]",
        "dark:shadow-[0px_1px_0px_0px_var(--color-neutral-950)_inset,0px_1px_0px_0px_var(--color-neutral-800)]",
        backdropBlur &&
          "after:absolute after:inset-0 after:h-full after:w-full after:backdrop-blur-lg after:content-['']",
        containerClassName
      )}>
      <GradientLayer layer={1} />
      <GradientLayer layer={2} />

      <motion.div
        className="absolute inset-x-0 top-0 h-1 rounded-t-2xl opacity-80 blur-sm [background:linear-gradient(to_right,var(--noise-gradient-1),var(--noise-gradient-2),var(--noise-gradient-3))] dark:[background:linear-gradient(to_right,var(--noise-gradient-1-dark),var(--noise-gradient-2-dark),var(--noise-gradient-3-dark))]"
        style={{
          x: animating ? topGradientX : 0,
        }}
      />

      <div className="not-prose pointer-events-none absolute inset-0 overflow-hidden">
        <img
          src="https://storage.chia1104.dev/noise.webp"
          alt="noise background"
          className="h-full w-full object-cover opacity-[var(--noise-opacity)] mix-blend-overlay"
          aria-hidden
        />
      </div>

      <div className={cn("relative z-10", className)}>{children}</div>
    </div>
  );
};
