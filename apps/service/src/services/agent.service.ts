import type { AgentKindService } from "@chia/api/orpc/services/agent.service";
import { CallerTier } from "@chia/service-kit/policies";

/**
 * The agent kinds this process serves, split from their implementation.
 *
 * `orpc.factory.ts` puts this map on every request context. The implementation reaches
 * `@chia/agent-runtime` and `@chia/agent-writing`, which carry the whole provider stack —
 * importing it here would put that stack in the eager module graph of a process whose other
 * routes never touch an agent. The delegate below defers it to the first agent call.
 *
 * The key is the literal rather than `WRITING_AGENT_KIND` for the same reason: importing that
 * constant pulls the domain package. It is matched against `agent_session.kind`, a database
 * string, and `writingAgentService` asserts the constant once its module is loaded.
 */
const impl = async (): Promise<AgentKindService> =>
  (await import("./writing-agent.service")).writingAgentService;

const writingAgentServiceDelegate: AgentKindService = {
  /** Restated rather than read through `impl()`: the guard needs it before any agent call. */
  minTier: CallerTier.Root,

  async listSessions(caller, input) {
    return await (await impl()).listSessions(caller, input);
  },

  async createSession(caller, input) {
    return await (await impl()).createSession(caller, input);
  },

  async getSession(caller, input) {
    return await (await impl()).getSession(caller, input);
  },

  async deleteSession(caller, input) {
    return await (await impl()).deleteSession(caller, input);
  },

  async updateSettings(caller, input) {
    return await (await impl()).updateSettings(caller, input);
  },

  async prompt(caller, input) {
    return await (await impl()).prompt(caller, input);
  },

  async attach(caller, input) {
    return await (await impl()).attach(caller, input);
  },

  async *stream(caller, input) {
    yield* (await impl()).stream(caller, input);
  },

  async abort(caller, input) {
    return await (await impl()).abort(caller, input);
  },

  async approve(caller, input) {
    return await (await impl()).approve(caller, input);
  },

  async compact(caller, input) {
    return await (await impl()).compact(caller, input);
  },

  async navigate(caller, input) {
    return await (await impl()).navigate(caller, input);
  },

  async getDraft(caller, input) {
    return (await (await impl()).getDraft?.(caller, input)) ?? null;
  },

  async validateModel(ref) {
    return await (await impl()).validateModel(ref);
  },

  async listModels(caller) {
    return await (await impl()).listModels(caller);
  },

  async listCapabilities() {
    return await (await impl()).listCapabilities();
  },
};

export const agentKinds = {
  writing: writingAgentServiceDelegate,
} satisfies Readonly<Record<string, AgentKindService>>;
