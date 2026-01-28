"use client";

import { useSelectedLayoutSegments } from "next/navigation";

import { Breadcrumbs } from "@heroui/react";

export function NavBreadcrumbs() {
  const segments = useSelectedLayoutSegments();
  return (
    <Breadcrumbs>
      {segments.map((segment) => (
        <Breadcrumbs.Item key={segment} href={`/${segment}`}>
          {segment}
        </Breadcrumbs.Item>
      ))}
    </Breadcrumbs>
  );
}
