"use client";

import { useMemo } from "react";
import type { FC } from "react";

import dayjs from "@chia/utils/day";

import { cn } from "../../utils/cn.util";
import { TimelineGroupList } from "./client";
import { TimelineProvider } from "./context";
import type {
  TimelineProps,
  TimelineItemData,
  TimelineGroupData,
} from "./types";

// Constants
const DEFAULT_GROUP_TEMPLATE = "YYYY";

// Helper function to get group name from data
const getGroupName = (
  data: TimelineItemData,
  template: string,
  timezone?: string
): string => {
  return dayjs(data.startDate).tz(timezone).format(template);
};

// Sort timeline data by date (newest first)
const sortTimelineData = (
  data: TimelineItemData[],
  timezone?: string
): TimelineItemData[] => {
  return [...data].sort(
    (a, b) =>
      dayjs(b.startDate).tz(timezone).valueOf() -
      dayjs(a.startDate).tz(timezone).valueOf()
  );
};

// Group timeline data by year/template
const groupTimelineData = (
  data: TimelineItemData[],
  groupTemplate: string,
  timezone?: string
): TimelineGroupData[] => {
  return data.reduce((acc, curr) => {
    const groupName = getGroupName(curr, groupTemplate, timezone);
    const lastGroup = acc[acc.length - 1];

    if (lastGroup?.year === groupName) {
      lastGroup.data.push(curr);
    } else {
      acc.push({
        year: groupName,
        data: [curr],
      });
    }

    return acc;
  }, [] as TimelineGroupData[]);
};

const Timeline: FC<TimelineProps> = ({
  data,
  groupTemplate = DEFAULT_GROUP_TEMPLATE,
  tz,
  enableSort = false,
  asyncDataStatus,
  onEndReached,
  className,
  ...restProps
}) => {
  // Sort data if enabled (without mutating original array)
  const sortedData = useMemo(
    () => (enableSort ? sortTimelineData(data, tz) : data),
    [data, enableSort, tz]
  );

  // Group data by template
  const groupedData = useMemo(
    () => groupTimelineData(sortedData, groupTemplate, tz),
    [sortedData, groupTemplate, tz]
  );

  return (
    <TimelineProvider groupTemplate={groupTemplate} tz={tz}>
      <div className={cn("my-2 flex flex-col gap-5", className)} {...restProps}>
        <TimelineGroupList
          data={groupedData}
          onEndReached={onEndReached}
          asyncDataStatus={asyncDataStatus}
        />
      </div>
    </TimelineProvider>
  );
};

export default Timeline;
