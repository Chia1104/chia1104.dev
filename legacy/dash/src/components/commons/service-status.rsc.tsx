import "server-only";

import { getMonitors } from "@chia/api/betterstack/uptime";

import { StatusChip } from "./status-chip";

export const ServiceStatus = async () => {
  const status = await getMonitors({
    next: {
      revalidate: 60,
    },
  });
  return <StatusChip status={status} />;
};
