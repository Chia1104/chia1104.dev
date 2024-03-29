"use client";

import { type FC, useMemo } from "react";
import dayjs from "dayjs";
import type { TimelineProps, Data, GroupData } from "./types";
import { GroupList } from "./client";
import { cn } from "../utils";

const getYear = (a: dayjs.Dayjs | string | number) => dayjs(a).year();

const getGroupName = (data: Data) => getYear(data.startDate);

const Timeline: FC<TimelineProps> = ({
  data,
  enableSort = true,
  className,
  asyncDataStatus,
  onEndReached,
  ...props
}) => {
  enableSort &&
    data.sort(
      (a, b) => dayjs(b.startDate).valueOf() - dayjs(a.startDate).valueOf()
    );
  const groupData = useMemo(() => {
    return data.reduce((acc, curr) => {
      const groupName = getGroupName(curr);
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
  }, [data]);
  return (
    <div className={cn("my-2 flex flex-col gap-5", className)} {...props}>
      <GroupList
        data={groupData}
        onEndReached={onEndReached}
        asyncDataStatus={asyncDataStatus}
      />
    </div>
  );
};

export default Timeline;
