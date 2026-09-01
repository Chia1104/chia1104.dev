"use client";

import { useFormatter, useTranslations } from "next-intl";

import { useAgentUsage, usageFractionOf } from "@chia/agent-elements/usage";
import { cn } from "@chia/ui/utils/cn.util";

import { client } from "@/libs/orpc/client";

/** This week's house allowance; hidden for the exempt operator. */
export const UsageMeter = () => {
  const t = useTranslations("chbot");
  const format = useFormatter();
  const usage = useAgentUsage(client.agent);
  const standing = usage.data;
  const fraction = standing ? usageFractionOf(standing) : null;

  if (!standing || fraction === null) {
    return null;
  }

  const percent = Math.round(fraction * 100);
  const reset = format.dateTime(new Date(standing.period.end), {
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
  });

  return (
    <div
      aria-label={t("usage", { percent })}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={percent}
      className="text-muted flex min-w-0 items-center gap-2 text-[11px]"
      role="meter">
      <span className="bg-surface-secondary h-1.5 w-16 shrink-0 overflow-hidden rounded-full">
        <span
          className={cn(
            "block h-full rounded-full",
            percent >= 100 ? "bg-danger" : "bg-accent"
          )}
          style={{ width: `${percent}%` }}
        />
      </span>
      <span className="truncate">
        {t("usage", { percent })} · {t("usageReset", { time: reset })}
      </span>
    </div>
  );
};
