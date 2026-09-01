"use client";

import { Slider } from "@heroui/react";

import { cn } from "@chia/ui/utils/cn.util";

import { useAgentLabels } from "./labels-context.tsx";
import type { AgentThinkingLevel } from "./types.ts";

export const THINKING_LEVELS: readonly AgentThinkingLevel[] = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
];

export interface ThinkingSliderProps {
  value: AgentThinkingLevel;
  onChange: (level: AgentThinkingLevel) => void;
  /** Called once the thumb settles; use it to persist without saving every step. */
  onCommit?: (level: AgentThinkingLevel) => void;
  isDisabled?: boolean;
  className?: string;
}

const levelAt = (index: number): AgentThinkingLevel =>
  THINKING_LEVELS[Math.max(0, Math.min(THINKING_LEVELS.length - 1, index))] ??
  "off";

export const ThinkingSlider = ({
  className,
  isDisabled,
  onChange,
  onCommit,
  value,
}: ThinkingSliderProps) => {
  const labels = useAgentLabels();
  const index = Math.max(0, THINKING_LEVELS.indexOf(value));
  const last = THINKING_LEVELS.length - 1;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted tracking-wide uppercase">
          {labels.thinkingLevel}
        </span>
        <span className="text-foreground font-medium">
          {labels.thinkingLevelNames[value]}
        </span>
      </div>
      <Slider
        aria-label={labels.thinkingLevel}
        className="w-full"
        isDisabled={isDisabled}
        maxValue={last}
        minValue={0}
        onChange={(next) =>
          onChange(levelAt(Array.isArray(next) ? (next[0] ?? 0) : next))
        }
        onChangeEnd={(next) =>
          onCommit?.(levelAt(Array.isArray(next) ? (next[0] ?? 0) : next))
        }
        step={1}
        value={index}>
        <Slider.Track className="relative">
          <Slider.Fill className="bg-accent" />
          {THINKING_LEVELS.map((level, stop) => (
            <span
              key={level}
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full",
                stop <= index ? "bg-accent-foreground/70" : "bg-muted/60"
              )}
              style={{ left: `${(stop / last) * 100}%` }}
            />
          ))}
          <Slider.Thumb className="border-accent" />
        </Slider.Track>
      </Slider>
    </div>
  );
};
