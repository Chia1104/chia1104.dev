/**
 * `@chia/agent-runtime` — engine-neutral agent execution and provider adapters.
 *
 * Agent kinds depend on the contracts and runtime factory from this package, then bind their
 * prompts, tools and policy to a concrete adapter. Host applications call the resulting runtime
 * without knowing which provider SDK implements it.
 *
 * Provider adapters are explicit subpath imports such as `@chia/agent-runtime/adapters/pi`, so the
 * neutral entrypoint does not load a provider SDK.
 */

export {
  type AgentCompactionResult,
  type AgentDefinition,
  type AgentEngineCreateOptions,
  type AgentEngineHandle,
  type AgentMaintenanceCreateOptions,
  type AgentMaintenanceEngineHandle,
  type AgentNavigationOptions,
  type AgentNavigationResult,
} from "./engine.ts";
export {
  createAgentRuntime,
  type AgentRuntimeFactory,
  type AgentTurnExecution,
  type AgentTurnMessage,
  type RunAgentTurnOptions,
} from "./runtime.ts";
