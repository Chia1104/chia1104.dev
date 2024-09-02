"use client";

import { createContext, useContext } from "react";

import type { TimelineProps } from "./types";

type TimelineContext = TimelineProps;

export const TimelineContext = createContext<TimelineContext>(
  {} as TimelineContext
);

export const useTimeline = () => {
  const context = useContext(TimelineContext);
  if (!context) {
    throw new Error("useTimeline must be used within a TimelineProvider");
  }
  return context;
};
