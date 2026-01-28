"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@heroui/react";

const ThemeSwitch = dynamic(() => import("@/components/commons/theme-switch"), {
  ssr: false,
  loading: () => <Skeleton className="w-[100px]" />,
});

export default function Page() {
  return <ThemeSwitch />;
}
