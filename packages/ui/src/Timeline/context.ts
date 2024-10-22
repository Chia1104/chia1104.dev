"use client";

import { createContext, use } from "react";

import type { TimelineProps } from "./types";

type TimelineContext = TimelineProps;

export const TimelineContext = createContext<TimelineContext>(
  {} as TimelineContext
);

export const useTimeline = () => {
  const context = use(TimelineContext);
  if (!context) {
    throw new Error("useTimeline must be used within a TimelineProvider");
  }
  return context;
};
