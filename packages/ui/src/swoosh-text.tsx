"use client";

import { motion } from "motion/react";

import { cn } from "../utils/cn.util";

interface SwooshTextProps {
  text?: string;
  className?: string;
  shadowColors?: {
    alpha?: string;
    beta?: string;
    gamma?: string;
    delta?: string;
    epsilon?: string;
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
  className = "",
  shadowColors = {
    alpha: "#07bccc",
    beta: "#e601c0",
    gamma: "#e9019a",
    delta: "#f40468",
    epsilon: "#f40468",
  },
  distance = {
    alpha: 10,
    beta: 15,
    gamma: 20,
    delta: 25,
    epsilon: 45,
  },
}: SwooshTextProps) {
  const textShadowStyle = {
    textShadow: `${distance.alpha}px ${distance.alpha}px 0px ${shadowColors.alpha}, 
                     ${distance.beta}px ${distance.beta}px 0px ${shadowColors.beta}, 
                     ${distance.gamma}px ${distance.gamma}px 0px ${shadowColors.gamma}, 
                     ${distance.delta}px ${distance.delta}px 0px ${shadowColors.delta}, 
                     ${distance.epsilon}px ${distance.epsilon}px 10px ${shadowColors.epsilon}`,
  };

  const noShadowStyle = {
    textShadow: "none",
  };

  return (
    <motion.span
      className={cn(
        "w-full cursor-pointer text-center text-3xl font-bold",
        "tracking-widest transition-all duration-200 ease-in-out",
        "text-black italic dark:text-white",
        "stroke-[#d6f4f4]",
        className
      )}
      style={textShadowStyle}
      whileHover={noShadowStyle}>
      {text}
    </motion.span>
  );
}
