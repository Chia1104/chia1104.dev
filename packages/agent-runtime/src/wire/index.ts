/**
 * The wire contract and its client-side view model, with no runtime dependency on Pi or any
 * provider SDK. This is the entry browsers and SSR bundles import; the package root re-exports the
 * Pi execution stack and is server-only. `replay.ts` is deliberately absent — rebuilding events from
 * persisted Pi entries classifies provider errors and so needs pi-ai.
 */
export {
  agentErrorKindSchema,
  agentWireEventSchema,
  type AgentWireEvent,
} from "./schema.ts";
export {
  AGENT_ERROR_HEADLINE,
  applyEvent,
  describeAgentError,
  emptyViewState,
  foldEvents,
  type AgentViewItem,
  type AgentViewState,
  type NoticeView,
  type TextMessageView,
  type ToolCallView,
} from "./fold.ts";
export { clipDetails } from "./clip.ts";
