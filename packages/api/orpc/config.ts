/**
 * Process-level defaults for oRPC guards that need values an app owns (env-driven
 * budgets, project ids). Registered once at boot by the hosting app — the same pattern
 * `events.ts` uses — so `packages/api` needs no env parsing of its own and each service
 * app stays the single source of truth for its configuration.
 */
export interface ORPCConfig {
  rateLimit: {
    windowMs: number;
    limit: number;
  };
  /** Project the `X-CH-API-KEY` must belong to, when the app scopes keys per project. */
  projectId?: number;
  /** Private half of the keypair the AI provider-key cookies are encrypted with. */
  aiAuthPrivateKey?: string;
}

const DEFAULT_CONFIG: ORPCConfig = {
  rateLimit: {
    windowMs: 5 * 60_000,
    limit: 300,
  },
};

let config: ORPCConfig = DEFAULT_CONFIG;

export const configureORPC = (next: Partial<ORPCConfig>): void => {
  config = {
    ...config,
    ...next,
    rateLimit: { ...config.rateLimit, ...next.rateLimit },
  };
};

export const getORPCConfig = (): ORPCConfig => config;

/** Test helper — restores the built-in defaults. */
export const resetORPCConfig = (): void => {
  config = DEFAULT_CONFIG;
};
