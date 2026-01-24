"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@heroui/react";

import type { Props } from "./date-format";

const InternalDateFormat = dynamic(() => import("./date-format"), {
  ssr: false,
  loading: () => <Skeleton className="h-4 w-25 rounded-full" />,
});

const DateFormat = (props: Props) => {
  return <InternalDateFormat {...props} />;
};

export default DateFormat;
