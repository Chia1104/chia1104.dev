"use client";

import { audienceOf, modelLabel } from "./shared";
import type { AgentModelInfo, KindAdmin } from "./shared";

interface SummaryRow {
  label: string;
  value: string;
  overridden: boolean;
}

const rowsOf = (
  kind: KindAdmin,
  models: readonly AgentModelInfo[] | undefined
): SummaryRow[] => {
  const { code, override, effective } = kind.defaults;
  const configOverrides = Object.keys(kind.config.override).length;
  return [
    {
      label: "Audience",
      value: audienceOf(kind.minTier.effective),
      overridden: kind.minTier.override !== null,
    },
    {
      label: "Model",
      value: modelLabel(effective, models),
      overridden: override.model !== null,
    },
    {
      label: "Thinking",
      value: effective.thinkingLevel,
      overridden: override.thinkingLevel !== null,
    },
    {
      label: "Pre-approved",
      value:
        effective.autoApprove.length > 0
          ? effective.autoApprove.join(", ")
          : "asks first",
      overridden:
        override.autoApprove !== null &&
        override.autoApprove.join() !== code.autoApprove.join(),
    },
    {
      label: "Configuration",
      value:
        configOverrides > 0
          ? `${configOverrides} ${configOverrides === 1 ? "field" : "fields"} changed`
          : "code defaults",
      overridden: configOverrides > 0,
    },
  ];
};

/**
 * What the agent runs as right now, before any form. A dot marks a value the operator
 * changed, so the sheet reads as the code's answer with the overrides called out.
 */
export const KindSummary = ({
  kind,
  models,
}: {
  kind: KindAdmin;
  models: readonly AgentModelInfo[] | undefined;
}) => (
  <dl className="page-md:grid-cols-3 page-lg:grid-cols-5 border-border grid grid-cols-2 gap-x-6 gap-y-4 border-y py-4">
    {rowsOf(kind, models).map((row) => (
      <div key={row.label} className="flex min-w-0 flex-col gap-1">
        <dt className="text-muted text-[11px] font-medium tracking-wider uppercase">
          {row.label}
        </dt>
        <dd className="flex min-w-0 items-start gap-1.5 text-sm font-medium">
          {row.overridden ? (
            <span
              aria-hidden
              className="bg-warning mt-2 size-1.5 shrink-0 rounded-full"
            />
          ) : null}
          <span className="text-pretty">{row.value}</span>
          {row.overridden ? (
            <span className="sr-only">, overridden</span>
          ) : null}
        </dd>
      </div>
    ))}
  </dl>
);
