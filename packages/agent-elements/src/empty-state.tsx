"use client";

import { Button } from "@heroui/react";
import { ArrowRight } from "lucide-react";

import { cn } from "@chia/ui/utils/cn.util";

import { useAgentLabels } from "./labels-context.tsx";
import { useAgentSession, useCanPrompt } from "./provider.tsx";

export interface EmptyStateProps {
  title?: string;
  description?: string;
  /** One-click starters; each sends as-is. */
  suggestions?: readonly string[];
  className?: string;
}

export const EmptyState = ({
  className,
  description,
  suggestions = [],
  title,
}: EmptyStateProps) => {
  const labels = useAgentLabels();
  const prompt = useAgentSession((state) => state.prompt);
  const canPrompt = useCanPrompt();

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-3xl flex-col gap-2.5 pt-[10vh]",
        className
      )}>
      <h1 className="text-foreground text-2xl font-medium tracking-tight sm:text-3xl">
        {title ?? labels.emptyTitle}
      </h1>
      <p className="text-muted max-w-[46ch] text-sm">
        {description ?? labels.emptyDescription}
      </p>
      {suggestions.length > 0 ? (
        <div className="mt-4 flex flex-col gap-1.5">
          {suggestions.map((suggestion) => (
            <Button
              key={suggestion}
              className="h-auto justify-between px-4 py-3 text-left text-sm font-normal"
              isDisabled={!canPrompt}
              onPress={() => void prompt(suggestion).catch(() => undefined)}
              variant="secondary">
              <span className="min-w-0 flex-1 truncate">{suggestion}</span>
              <ArrowRight className="text-muted size-4 shrink-0" />
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
};
