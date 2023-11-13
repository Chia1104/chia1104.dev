import React, { type FC } from "react";
import dayjs from "dayjs";
import type { TimelineProps, TimelineData, Data } from "./types";
import { List } from "./client";

/**
 * ```ts
 * const timelineData = {
 *  "2023": [
 *      {
 *          title: "Bachelor of Science in Computer Science",
 *          subtitle: "National Taiwan University",
 *          startDate: new Date("2023-09-01"),
 *          content: "I will be studying computer science at NTU.",
 *      }
 *  ],
 *  "2022": [
 *      {
 *          title: "Bachelor of Science in Computer Science",
 *          subtitle: "National Taiwan University",
 *          startDate: new Date("2022-09-01"),
 *          content: "I will be studying computer science at NTU.",
 *      }
 *  ]
 * }
 * ```
 */
const groupData = (data: Data[]): TimelineData => {
  const timelineData: TimelineData = {};
  data.forEach((item) => {
    const year = dayjs(item.startDate).format("YYYY");
    if (!timelineData[year]) {
      timelineData[year] = [];
    }
    timelineData[year].push(item);
  });
  return timelineData;
};

const Timeline: FC<TimelineProps> = ({ data, ...props }) => {
  const groupedData = groupData(data);
  console.log(groupedData);
  return (
    <div className="flex flex-col" {...props}>
      {Object.keys(groupedData).map((year) => (
        <List key={year} year={year} data={groupedData[year]} />
      ))}
    </div>
  );
};

export default Timeline;
