import React, { type FC } from "react";
import dayjs from "dayjs";
import type { TimelineProps, Data, GroupData } from "./types";
import { List } from "./client";

const getYear = (a: dayjs.Dayjs | string | number) => dayjs(a).year();

const getGroupName = (data: Data) => getYear(data.startDate);

const Timeline: FC<TimelineProps> = ({ data, ...props }) => {
  data.sort((a, b) => b.startDate - a.startDate);
  return (
    <div className="flex flex-col" {...props}>
      {data
        .reduce((acc, curr) => {
          acc.push({
            year: getGroupName(curr),
            data: [curr],
          });
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
