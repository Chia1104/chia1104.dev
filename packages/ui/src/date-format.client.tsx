"use client";

import { Skeleton } from "@heroui/react";
import dynamic from "next/dynamic";

import type { Props } from "./date-format";

const InternalDateFormat = dynamic(() => import("./date-format"), {
  ssr: false,
  loading: () => <Skeleton className="w-25 h-4 rounded-full" />,
});

const DateFormat = (props: Props) => {
  return <InternalDateFormat {...props} />;
};

export default DateFormat;
