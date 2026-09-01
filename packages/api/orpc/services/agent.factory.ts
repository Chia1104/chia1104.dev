import { assertAgentKind } from "@chia/agent-host/kind";
import type {
  AgentKindDefinition,
  AgentKindEntry,
} from "@chia/agent-host/kind";
import type { AgentCredentials } from "@chia/agent-runtime/models";
import type { CallerTier } from "@chia/service-kit/policies/caller.policy";
import type { EncryptedAgentCredentials } from "@chia/workflow-control/agent-hooks";

import type { AgentKindService } from "./agent.service";
import type { AgentAdminService } from "./agent/admin";
import type { AgentUsageService } from "./agent/usage";

type LoadedAgentKind = AgentKindDefinition<unknown, object>;

export interface AgentCredentialHost {
  read(headers: Headers): EncryptedAgentCredentials | undefined;
  decrypt(credentials: EncryptedAgentCredentials | undefined): AgentCredentials;
}

export interface AgentRunReadable<T> extends ReadableStream<T> {
  getTailIndex(): Promise<number>;
}

export interface AgentRunHandle {
  readonly exists: Promise<boolean>;
  readonly status: Promise<string>;
  getReadable<T>(options?: {
    namespace?: string;
    startIndex?: number;
  }): AgentRunReadable<T>;
}

export interface AgentRunHost {
  get(runId: string): AgentRunHandle;
  hasHook(token: string): Promise<boolean>;
}

export interface AgentServiceHost {
  credentials: AgentCredentialHost;
  runs: AgentRunHost;
}

export interface CreateAgentFactoryOptions extends AgentServiceHost {
  /**
   * The kinds this process serves, keyed by stable id in presentation order. Each entry
   * carries the eager tier floor and a dynamic import that keeps the domain package off
   * the non-agent boot path.
   */
  kinds: Readonly<Record<string, AgentKindEntry>>;
}

/**
 * Host-specific environment declared once; each resolve gets a fresh stateless service.
 * Definitions are not stored in a Map; dynamic import caching is sufficient.
 */
export interface AgentFactory {
  readonly kinds: readonly string[];
  /** The registered tier floor for `kind`, readable without loading the definition. */
  minTierOf(kind: string): CallerTier | undefined;
  load(kind: string): Promise<LoadedAgentKind | undefined>;
  create(kind: string): Promise<AgentKindService | undefined>;
  createAdmin(): Promise<AgentAdminService>;
  createUsage(): Promise<AgentUsageService>;
}

export const createAgentFactory = (
  options: CreateAgentFactoryOptions
): AgentFactory => {
  /** `kind` arrives from client input and session rows; a Map keeps prototype names from matching. */
  const entries = new Map(Object.entries(options.kinds));
  const kinds = [...entries.keys()];

  const load = async (kind: string): Promise<LoadedAgentKind | undefined> => {
    const entry = entries.get(kind);
    if (!entry) return undefined;
    const definition = assertAgentKind(kind, await entry.load());
    if (definition.minTier !== entry.minTier) {
      throw new Error(
        `Agent kind "${kind}" is registered with a different minTier than its definition.`
      );
    }
    return definition;
  };

  return {
    kinds,
    minTierOf: (kind) => entries.get(kind)?.minTier,
    load,
    async create(kind) {
      const definition = await load(kind);
      if (!definition) return undefined;
      const { createAgentKindService } = await import("./agent/service");
      return createAgentKindService(definition, options);
    },
    async createAdmin() {
      const { createAgentAdminService } = await import("./agent/admin");
      return createAgentAdminService({ kinds, load });
    },
    async createUsage() {
      const { createAgentUsageService } = await import("./agent/usage");
      return createAgentUsageService(options.runs);
    },
  };
};
