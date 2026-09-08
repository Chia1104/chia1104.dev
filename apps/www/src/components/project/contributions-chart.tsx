"use client";

import { cloneElement } from "react";

import { Tooltip } from "@heroui/react";
import { useFormatter, useTranslations } from "next-intl";
import { ActivityCalendar } from "react-activity-calendar";
import type { Activity } from "react-activity-calendar";

import dayjs from "@chia/utils/day";

export const ContributionsChart = ({ data }: { data: Activity[] }) => {
  const t = useTranslations("projects.calendar");
  const format = useFormatter();
  /*
   * The calendar stringifies `{{count}}` itself, so the total is grouped here and only `{{year}}`
   * is left for it to fill in.
   */
  const totalCount = format.number(
    data.reduce((total, day) => total + day.count, 0)
  );

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
        <Tooltip closeDelay={0} delay={0}>
          <Tooltip.Trigger<"rect">
            render={(triggerProps) => cloneElement(block, triggerProps)}
          />
          <Tooltip.Content>
            {t("tooltip", {
              count: activity.count,
              date: dayjs(activity.date).format("ll"),
            })}
          </Tooltip.Content>
        </Tooltip>
      )}
      labels={{
        months: t.raw("months"),
        weekdays: t.raw("weekdays"),
        totalCount: String(t.raw("total-count")).replace(
          "{{count}}",
          totalCount
        ),
        legend: {
          less: t("legend.less"),
          more: t("legend.more"),
        },
      }}
    />
  );
};
