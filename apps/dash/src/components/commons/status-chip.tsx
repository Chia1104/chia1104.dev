"use client";

import Link from "next/link";
import { useMemo } from "react";

import { Chip, Skeleton, Tooltip } from "@heroui/react";

import type {
  Monitor,
  MonitorStatus,
  Monitors,
} from "@chia/api/betterstack/types";

const STATUS_PRIORITY = [
  "down",
  "pending",
  "maintenance",
  "paused",
  "validating",
  "up",
] as const satisfies readonly MonitorStatus[];

const monitorLabel = (status: MonitorStatus) => {
  switch (status) {
    case "up":
      return { label: "Service Up", color: "success" } as const;
    case "down":
      return { label: "Service Down", color: "danger" } as const;
    case "pending":
      return { label: "Service Pending", color: "warning" } as const;
    case "maintenance":
      return { label: "Service Maintenance", color: "default" } as const;
    case "paused":
      return { label: "Service Paused", color: "default" } as const;
    case "validating":
      return { label: "Service Validating", color: "warning" } as const;
  }
};

const aggregateLabel = (
  status: MonitorStatus | "unknown",
  monitors: Monitor[]
) => {
  switch (status) {
    case "up":
      return { label: "All services are up", color: "success" } as const;
    case "down":
      return { label: "Some services are down", color: "danger" } as const;
    case "pending":
      return { label: "Some services are pending", color: "warning" } as const;
    case "maintenance":
      return {
        label: "Some services are in maintenance",
        color: "default",
      } as const;
    case "paused":
      return {
        label: monitors.every(
          (monitor) => monitor.attributes.status === "paused"
        )
          ? "All services are paused"
          : "Some services are paused",
        color: "default",
      } as const;
    case "validating":
      return {
        label: "Some services are validating",
        color: "warning",
      } as const;
    default:
      return { label: "Unknown", color: "default" } as const;
  }
};

export const LoadingFallback = () => {
  return (
    <Chip className="text-muted border-none px-0" color="default">
      <Skeleton className="h-4 w-20 rounded-full" />
    </Chip>
  );
};

export const ErrorFallback = () => {
  return (
    <Chip className="text-muted border-none px-0" color="danger">
      Service Error
    </Chip>
  );
};

export const StatusChip = ({ status }: { status: Monitors }) => {
  const serviceStatus = useMemo(() => {
    if (status.data.length === 0) {
      return "unknown";
    }

    return (
      STATUS_PRIORITY.find((priority) =>
        status.data.some((monitor) => monitor.attributes.status === priority)
      ) ?? "unknown"
    );
  }, [status]);

  const current = useMemo(
    () => aggregateLabel(serviceStatus, status.data),
    [serviceStatus, status.data]
  );

  return (
    <Tooltip>
      <Tooltip.Trigger>
        <Chip className="text-muted border-none" color={current.color}>
          <Link
            href="https://status.chia1104.dev/"
            target="_blank"
            rel="noopener noreferrer">
            {current.label}
          </Link>
        </Chip>
      </Tooltip.Trigger>
      <Tooltip.Content className="min-w-48">
        <ul className="flex flex-col gap-3 p-3">
          {status.data.map((monitor) => {
            const item = monitorLabel(monitor.attributes.status);
            return (
              <li key={monitor.id} className="flex flex-col gap-1">
                <span>{monitor.attributes.pronounceable_name}</span>
                <Chip className="text-muted border-none" color={item.color}>
                  {item.label}
                </Chip>
              </li>
            );
          })}
        </ul>
      </Tooltip.Content>
    </Tooltip>
  );
};
