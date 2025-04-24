"use client";

import { useMemo } from "react";

import { Chip, Skeleton, Tooltip, Link } from "@heroui/react";

import type { Monitors, Monitor } from "@chia/api/betterstack/types";

export const LoadingFallback = () => {
  return (
    <Chip
      className="border-none px-0 text-default-500"
      color="default"
      variant="dot">
      <Skeleton className="h-4 w-20 rounded-full" />
    </Chip>
  );
};

export const ErrorFallback = () => {
  return (
    <Chip
      className="border-none px-0 text-default-500"
      color="danger"
      variant="dot">
      Service Error
    </Chip>
  );
};

export const StatusChip = ({ status }: { status: Monitors }) => {
  const serviceStatus = useMemo(() => {
    const allUp = status.data.every(
      (monitor) => monitor.attributes.status === "up"
    );

    // find down first, then pending, then maintenance
    const errorService =
      status.data.find((monitor) => monitor.attributes.status === "down") ||
      status.data.find((monitor) => monitor.attributes.status === "pending") ||
      status.data.find(
        (monitor) => monitor.attributes.status === "maintenance"
      );

    if (allUp) {
      return "up";
    } else if (errorService) {
      return errorService.attributes.status;
    } else {
      return "unknown";
    }
  }, [status]);

  const getColorAndLabel = (status: Monitor) => {
    switch (status.attributes.status) {
      case "up":
        return {
          label: "Service Up",
          color: "success",
        } as const;
      case "down":
        return {
          label: "Service Down",
          color: "danger",
        } as const;
      case "pending":
        return {
          label: "Service Pending",
          color: "warning",
        } as const;
      case "maintenance":
        return {
          label: "Service Maintenance",
          color: "default",
        } as const;
      default:
        return {
          label: "Unknown",
          color: "default",
        } as const;
    }
  };

  const current = useMemo(() => {
    switch (serviceStatus) {
      case "up":
        return {
          label: "All services are up",
          color: "success",
        } as const;
      case "down":
        return {
          label: "Some services are down",
          color: "danger",
        } as const;
      case "pending":
        return {
          label: "Some services are pending",
          color: "warning",
        } as const;
      case "maintenance":
        return {
          label: "Some services are in maintenance",
          color: "default",
        } as const;
      default:
        return {
          label: "Unknown",
          color: "default",
        } as const;
    }
  }, [serviceStatus]);

  return (
    <Tooltip
      content={
        <ul className="flex flex-col p-3 gap-3">
          {status.data.map((monitor) => (
            <li key={monitor.id} className="flex flex-col">
              <span>{monitor.attributes.pronounceable_name}</span>
              <Chip
                className="border-none px-0 text-default-500"
                color={getColorAndLabel(monitor).color}
                variant="dot">
                {getColorAndLabel(monitor).label}
              </Chip>
            </li>
          ))}
        </ul>
      }>
      <Chip
        as={Link}
        href="https://status.chia1104.dev/"
        target="_blank"
        rel="noopener noreferrer"
        className="border-none px-0 text-default-500"
        color={current.color}
        variant="dot">
        {current.label}
      </Chip>
    </Tooltip>
  );
};
