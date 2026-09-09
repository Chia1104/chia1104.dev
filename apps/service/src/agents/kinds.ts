import { CallerTier } from "@chia/auth/tier";

/** The floor each hosted kind's definition declares; the operator may raise it per kind. */
export const agentKindFloors = {
  writing: CallerTier.Root,
  public: CallerTier.Guest,
} as const satisfies Record<string, CallerTier>;
