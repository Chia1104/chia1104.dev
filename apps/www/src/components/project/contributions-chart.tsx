"use client";

import { useTranslations } from "next-intl";
import { ActivityCalendar } from "react-activity-calendar";
import type { Activity } from "react-activity-calendar";

import { Tooltip, TooltipTrigger, TooltipContent } from "@chia/ui/tooltip";
import dayjs from "@chia/utils/day";

export const ContributionsChart = ({ data }: { data: Activity[] }) => {
  const t = useTranslations("projects.calendar");

  return (
    <ActivityCalendar
      data={data}
      colorScheme="dark"
      theme={{
        dark: [
          "var(--activity-0)",
          "var(--activity-1)",
          "var(--activity-2)",
          "var(--activity-3)",
          "var(--activity-4)",
        ],
      }}
      className="max-w-full"
      renderBlock={(block, activity) => (
        <Tooltip>
          <TooltipTrigger asChild>{block}</TooltipTrigger>
          <TooltipContent>
            {t("tooltip", {
              count: activity.count,
              date: dayjs(activity.date).format("ll"),
            })}
          </TooltipContent>
        </Tooltip>
      )}
      labels={{
        months: t.raw("months"),
        weekdays: t.raw("weekdays"),
        totalCount: t.raw("total-count"),
        legend: {
          less: t("legend.less"),
          more: t("legend.more"),
        },
      }}
    />
  );
};
