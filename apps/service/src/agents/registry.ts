import type { AgentKindService } from "@chia/api/orpc/services/agent.service";
import { AppError } from "@chia/service-kit/errors";
import { CallerTier } from "@chia/service-kit/policies/caller.policy";

import type { AgentKindDefinition, AgentKindEntry } from "./kind";

/**
 * The agent kinds this process serves — the one place a kind is registered.
 *
 * `createORPCContext` puts the services derived from this map on every request context, and the
 * turn step resolves `agent.session.kind` against the same map. Keys are literals matched against
 * that database string; each definition asserts its own `kind` constant once loaded, so the two
 * cannot drift silently.
 *
 * Static registration is intentional: workflow steps are deployment-versioned bundles, so a kind
 * is code, not a row. Nothing here imports a domain package at module scope — this module is on
 * the boot path of every process that hosts the router or the workflow.
 */
export const AGENT_KINDS = {
  writing: {
    minTier: CallerTier.Root,
    load: () => import("./writing").then((m) => m.writingAgentKind),
  },
} satisfies Readonly<Record<string, AgentKindEntry>>;

/** `AGENT_KINDS` keyed by the database string; a `Map` keeps prototype names from matching. */
const entries = new Map<string, AgentKindEntry>(Object.entries(AGENT_KINDS));

const definitions = new Map<string, Promise<AgentKindDefinition<unknown>>>();

/** The loaded definition for `kind`, or `undefined` when this process has none. */
export const loadAgentKind = (
  kind: string
): Promise<AgentKindDefinition<unknown>> | undefined => {
  const entry = entries.get(kind);
  if (!entry) return undefined;
  let loading = definitions.get(kind);
  if (!loading) {
    loading = entry.load().then((definition) => {
      if (definition.kind !== kind) {
        throw new Error(
          `Agent kind "${kind}" loaded a definition for "${definition.kind}".`
        );
      }
      if (definition.minTier !== entry.minTier) {
        throw new Error(
          `Agent kind "${kind}" is registered with a different minTier than its definition.`
        );
      }
      return definition;
    });
    loading.catch(() => definitions.delete(kind));
    definitions.set(kind, loading);
  }
  return loading;
};

/**
 * The service for one registered kind, constructed on first use.
 *
 * `./service` reaches `@chia/agent-runtime`, the workflow API and — through the definition — the
 * domain package and provider SDKs. Deferring it to the first agent call keeps all of that out of
 * the eager module graph. `minTier` is restated on the delegate because the guard needs it before
 * any call is made.
 */
const createLazyAgentKindService = (
  kind: string,
  entry: AgentKindEntry
): AgentKindService => {
  let service: Promise<AgentKindService> | undefined;
  const impl = () => {
    service ??= Promise.all([import("./service"), loadAgentKind(kind)]).then(
      ([{ createAgentKindService }, definition]) => {
        if (!definition) {
          throw new AppError("SERVICE_UNAVAILABLE", {
            message: `Agent kind "${kind}" is not available in this process.`,
          });
        }
        return createAgentKindService(definition);
      }
    );
    service.catch(() => (service = undefined));
    return service;
  };

  return {
    minTier: entry.minTier,
    listSessions: async (caller, input) =>
      (await impl()).listSessions(caller, input),
    createSession: async (caller, input) =>
      (await impl()).createSession(caller, input),
    getSession: async (caller, input) =>
      (await impl()).getSession(caller, input),
    deleteSession: async (caller, input) =>
      (await impl()).deleteSession(caller, input),
    updateSettings: async (caller, input) =>
      (await impl()).updateSettings(caller, input),
    prompt: async (caller, input) => (await impl()).prompt(caller, input),
    attach: async (caller, input) => (await impl()).attach(caller, input),
    async *stream(caller, input) {
      yield* (await impl()).stream(caller, input);
    },
    abort: async (caller, input) => (await impl()).abort(caller, input),
    approve: async (caller, input) => (await impl()).approve(caller, input),
    compact: async (caller, input) => (await impl()).compact(caller, input),
    navigate: async (caller, input) => (await impl()).navigate(caller, input),
    getDraft: async (caller, input) =>
      (await (await impl()).getDraft?.(caller, input)) ?? null,
    validateModel: async (ref) => (await impl()).validateModel(ref),
    listModels: async (caller) => (await impl()).listModels(caller),
    listCapabilities: async () => (await impl()).listCapabilities(),
  };
};

export const agentKinds: Readonly<Record<string, AgentKindService>> =
  Object.fromEntries(
    Object.entries(AGENT_KINDS).map(([kind, entry]) => [
      kind,
      createLazyAgentKindService(kind, entry),
    ])
  );
