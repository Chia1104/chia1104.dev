import React, { type FC } from "react";
import dayjs from "dayjs";
import type { TimelineProps, Data, GroupData } from "./types";
import { List } from "./client";

const getYear = (a: dayjs.Dayjs | string | number) => dayjs(a).year();

const getGroupName = (data: Data) => getYear(data.startDate);

const Timeline: FC<TimelineProps> = ({ data, enableSort = true, ...props }) => {
  enableSort &&
    data.sort(
      (a, b) => dayjs(b.startDate).valueOf() - dayjs(a.startDate).valueOf()
    );
  return (
    <div className="my-2 flex flex-col gap-5" {...props}>
      {data
        .reduce((acc, curr) => {
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
        }, [] as GroupData[])
        .map((item) => (
          <List
            key={item.year.toString()}
            year={item.year.toString()}
            data={item.data}
          />
        ))}
    </div>
  );
};

export default Timeline;
