"use client";

import { Label, ProgressBar } from "@heroui/react";
import { useFormatter, useTranslations } from "next-intl";

import { useAgentUsage, usageFractionOf } from "@chia/agent-elements/usage";

import { client } from "@/libs/orpc/client";

/** This week's house allowance; hidden for the exempt operator. */
export const UsageMeter = () => {
  const t = useTranslations("chbot");
  const format = useFormatter();
  const usage = useAgentUsage(client.agent);
  const standing = usage.data;
  const fraction = standing ? (usageFractionOf(standing) ?? 0) : 0;

  if (!standing) {
    return null;
  }

  const percent = Math.round(fraction * 100);
  const reset = format.dateTime(new Date(standing.period.end), {
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
  });

  return (
    <ProgressBar
      className="min-w-0 flex-1"
      color={percent >= 100 ? "danger" : "accent"}
      size="sm"
      value={percent}>
      <Label className="text-muted truncate text-[11px] font-normal">
        {t("usage", { percent })}
      </Label>
      <ProgressBar.Output className="text-muted text-[11px] font-normal">
        {t("usageReset", { time: reset })}
      </ProgressBar.Output>
      <ProgressBar.Track>
        <ProgressBar.Fill />
      </ProgressBar.Track>
    </ProgressBar>
  );
};
