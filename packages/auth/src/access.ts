import type { DB } from "@chia/db/client";
import { listAgentKindConfigs } from "@chia/db/repos/agent/config";

import type { TieredUser } from "./tier";
import { CallerTier, agentKindFloor, tierForUser } from "./tier";

/** How much of the dashboard a session opens. */
export const DashboardAccess = {
  /** The configured admin. */
  Operator: "operator",
  Member: "member",
} as const;

export type DashboardAccess =
  (typeof DashboardAccess)[keyof typeof DashboardAccess];

/**
 * What the session's holder may open, projected onto the session for the frontends.
 * Guards never read it: the service decides from the caller's tier on every request.
 */
export interface Access {
  /** The tier this session grades to on its own, without an API key. */
  tier: CallerTier;
  /** A guest has no dashboard at all. */
  dashboard: DashboardAccess | null;
  /** The tier each hosted agent kind admits right now, keyed by kind id. */
  agent: Record<string, CallerTier>;
}

export interface AccessOptions {
  /** Every agent kind the service hosts with the floor its definition declares. */
  agentKinds: Readonly<Record<string, CallerTier>>;
}

export const resolveAccess = async (
  db: DB,
  user: TieredUser,
  adminId: string,
  options: AccessOptions
): Promise<Access> => {
  const tier = tierForUser(user, adminId);
  const rows = await listAgentKindConfigs(db);
  const agent: Record<string, CallerTier> = {};
  for (const [kind, code] of Object.entries(options.agentKinds)) {
    agent[kind] = agentKindFloor(
      code,
      rows.find((row) => row.kind === kind)?.minTier
    );
  }
  return {
    tier,
    dashboard:
      tier === CallerTier.Guest
        ? null
        : tier === CallerTier.Root
          ? DashboardAccess.Operator
          : DashboardAccess.Member,
    agent,
  };
};
