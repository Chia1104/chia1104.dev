"use client";

import { useMemo } from "react";
import type { FC } from "react";

import dayjs from "dayjs";
import tz from "dayjs/plugin/timezone";

import { cn } from "../utils";
import { GroupList } from "./client";
import { TimelineContext } from "./context";
import type { TimelineProps, Data, GroupData } from "./types";

dayjs.extend(tz);

const getGroupName = (data: Data, template = "YYYY", timezone?: string) =>
  dayjs(data.startDate).tz(timezone).format(template);

const Timeline: FC<TimelineProps> = ({
  groupTemplate = "YYYY",
  tz = "UTC",
  enableSort,
  ...props
}) => {
  if (enableSort)
    props.data.sort(
      (a, b) =>
        dayjs(b.startDate).tz(tz).valueOf() -
        dayjs(a.startDate).tz(tz).valueOf()
    );
  const groupData = useMemo(() => {
    return props.data.reduce((acc, curr) => {
      const groupName = getGroupName(curr, groupTemplate);
      const lastGroup = acc[acc.length - 1];
      if (lastGroup && lastGroup.year === groupName) {
        lastGroup.data.push(curr);
      } else {
        acc.push({
          year: groupName,
          data: [curr],
        });
      }
      return acc;
    }, [] as GroupData[]);
  }, [props.data, groupTemplate]);
  return (
    <TimelineContext.Provider value={{ groupTemplate, tz, ...props }}>
      <div
        className={cn("my-2 flex flex-col gap-5", props.className)}
        {...props}>
        <GroupList
          data={groupData}
          onEndReached={props.onEndReached}
          asyncDataStatus={props.asyncDataStatus}
        />
      </div>
    </TimelineContext.Provider>
  );
};

export default Timeline;
