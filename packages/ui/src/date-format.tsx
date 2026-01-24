"use client";

import type { ConfigType } from "dayjs";

import type dayjs from "@chia/utils/day";

import type { Options } from "../utils/use-date";
import { useDate } from "../utils/use-date";

export interface Props extends Options {
  date: ConfigType;
  format?: string;
  dayjs?: typeof dayjs;
}

const DateFormat = ({ date, format = "ll", dayjs, ...options }: Props) => {
  const { formatDate } = useDate(dayjs, options);

  return formatDate(date, format);
};

export default DateFormat;
