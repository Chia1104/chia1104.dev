"use client";

import type { ConfigType } from "dayjs";

import { useDate } from "../utils/use-date";

export interface Props {
  date: ConfigType;
  format?: string;
}

const DateFormat = ({ date, format = "ll" }: Props) => {
  const { formatDate } = useDate();

  return formatDate(date, format);
};

export default DateFormat;
