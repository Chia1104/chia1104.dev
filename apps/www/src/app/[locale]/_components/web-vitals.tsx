"use client";

import { useReportWebVitals } from "next/web-vitals";

import { env } from "@/env";

export function WebVitals() {
  useReportWebVitals((metric) => {
    if (env.NEXT_PUBLIC_ENV !== "production") {
      return;
    }
    window.gtag("event", metric.name, {
      value: Math.round(
        metric.name === "CLS"
          ? Number(metric.value) * 1000
          : Number(metric.value)
      ), // values must be integers
      event_label: metric.id, // id unique to current page load
      non_interaction: true, // avoids affecting bounce rate.
    });
  });
  return null;
}
