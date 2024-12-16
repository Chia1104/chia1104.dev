"use client";

import dayjs from "@chia/utils/day";

import { useDate } from "@/hooks/use-date";

interface Props {
  date: dayjs.ConfigType;
  format?: string;
}

const DateFormat = ({ date, format = "ll" }: Props) => {
  const { formatDate } = useDate();

  return formatDate(date, format);
};

export default DateFormat;
