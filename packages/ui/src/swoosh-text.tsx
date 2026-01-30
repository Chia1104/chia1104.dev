"use client";

import type { CSSProperties, ComponentPropsWithoutRef } from "react";

import { cn } from "../utils/cn.util";

interface SwooshTextProps extends ComponentPropsWithoutRef<"span"> {
  text?: string;
  shadowColors?: {
    default?: {
      alpha?: string;
      beta?: string;
      gamma?: string;
      delta?: string;
      epsilon?: string;
    };
    dark?: {
      alpha?: string;
      beta?: string;
      gamma?: string;
      delta?: string;
      epsilon?: string;
    };
  };
  distance?: {
    alpha?: number;
    beta?: number;
    gamma?: number;
    delta?: number;
    epsilon?: number;
  };
}

export function SwooshText({
  text = "Hover Me",
  shadowColors = {
    default: {
      alpha: "#07bccc",
      beta: "#e601c0",
      gamma: "#e9019a",
      delta: "#f40468",
      epsilon: "#f40468",
    },
    dark: {
      alpha: "#07bccc",
      beta: "#e601c0",
      gamma: "#e9019a",
      delta: "#f40468",
      epsilon: "#f40468",
    },
  },
  distance = {
    alpha: 10,
    beta: 15,
    gamma: 20,
    delta: 25,
    epsilon: 45,
  },
  ...props
}: SwooshTextProps) {
  const cssVars = {
    "--swoosh-d-alpha": `${distance.alpha ?? 0}px`,
    "--swoosh-c-alpha": shadowColors.default?.alpha ?? "transparent",
    "--swoosh-d-beta": `${distance.beta ?? 0}px`,
    "--swoosh-c-beta": shadowColors.default?.beta ?? "transparent",
    "--swoosh-d-gamma": `${distance.gamma ?? 0}px`,
    "--swoosh-c-gamma": shadowColors.default?.gamma ?? "transparent",
    "--swoosh-d-delta": `${distance.delta ?? 0}px`,
    "--swoosh-c-delta": shadowColors.default?.delta ?? "transparent",
    "--swoosh-d-epsilon": `${distance.epsilon ?? 0}px`,
    "--swoosh-c-epsilon": shadowColors.default?.epsilon ?? "transparent",
    "--swoosh-dark-c-alpha": shadowColors.dark?.alpha ?? "transparent",
    "--swoosh-dark-c-beta": shadowColors.dark?.beta ?? "transparent",
    "--swoosh-dark-c-gamma": shadowColors.dark?.gamma ?? "transparent",
    "--swoosh-dark-c-delta": shadowColors.dark?.delta ?? "transparent",
    "--swoosh-dark-c-epsilon": shadowColors.dark?.epsilon ?? "transparent",
  } as CSSProperties;

  return (
    <span
      {...props}
      style={
        {
          ...cssVars,
          ...props?.style,
        } as CSSProperties
      }
      className={cn(
        "w-full cursor-pointer text-center text-3xl font-bold",
        "tracking-widest transition-all duration-200 ease-in-out",
        "text-black italic dark:text-white",
        "stroke-[#d6f4f4]",
        "[text-shadow:var(--swoosh-d-alpha)_var(--swoosh-d-alpha)_0_var(--swoosh-c-alpha),var(--swoosh-d-beta)_var(--swoosh-d-beta)_0_var(--swoosh-c-beta),var(--swoosh-d-gamma)_var(--swoosh-d-gamma)_0_var(--swoosh-c-gamma),var(--swoosh-d-delta)_var(--swoosh-d-delta)_0_var(--swoosh-c-delta),var(--swoosh-d-epsilon)_var(--swoosh-d-epsilon)_10px_var(--swoosh-c-epsilon)]",
        "dark:[text-shadow:var(--swoosh-d-alpha)_var(--swoosh-d-alpha)_0_var(--swoosh-dark-c-alpha),var(--swoosh-d-beta)_var(--swoosh-d-beta)_0_var(--swoosh-dark-c-beta),var(--swoosh-d-gamma)_var(--swoosh-d-gamma)_0_var(--swoosh-dark-c-gamma),var(--swoosh-d-delta)_var(--swoosh-d-delta)_0_var(--swoosh-dark-c-delta),var(--swoosh-d-epsilon)_var(--swoosh-d-epsilon)_10px_var(--swoosh-dark-c-epsilon)]",
        "hover:[text-shadow:none]",
        props?.className
      )}>
      {text}
    </span>
  );
}
