"use client";

import { createContext, use, useMemo } from "react";
import type { FC, PropsWithChildren } from "react";

import type { TimelineContextValue } from "./types";

const DEFAULT_GROUP_TEMPLATE = "YYYY";

export const TimelineContext = createContext<TimelineContextValue | null>(null);

export const useTimeline = (name = "useTimeline") => {
  const context = use(TimelineContext);
  if (!context) {
    throw new Error(`${name} must be used within a TimelineProvider`);
  }
  return context;
};

interface TimelineProviderProps extends PropsWithChildren {
  groupTemplate?: string;
  tz?: string;
}

export const TimelineProvider: FC<TimelineProviderProps> = ({
  children,
  groupTemplate = DEFAULT_GROUP_TEMPLATE,
  tz,
}) => {
  const value = useMemo(
    () => ({
      groupTemplate,
      tz,
    }),
    [groupTemplate, tz]
  );

  return <TimelineContext value={value}>{children}</TimelineContext>;
};
