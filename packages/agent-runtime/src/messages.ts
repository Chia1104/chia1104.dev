import type { JsonObject, JsonValue } from "@chia/utils/json";

/**
 * The transcript as `agent.session_entry` stores it. The runtime owns this shape rather than the
 * engine's: it records what the engine's messages do not (usage, stop reason, tool details), and
 * every row the tree already holds shares it, so the whole tree reads alike.
 */

export interface TextContent {
  type: "text";
  text: string;
}

export interface ThinkingContent {
  type: "thinking";
  thinking: string;
  /** Opaque to everyone but the API named by the message's `api`, which needs it back verbatim. */
  thinkingSignature?: string;
}

export interface ToolCallContent {
  type: "toolCall";
  id: string;
  name: string;
  arguments: JsonObject;
}

export interface UsageCost {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  total: number;
}

/** Tokens of one provider call; `input` excludes cache reads and writes, which have their own price. */
export interface Usage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  /** Subset of `output`; only some providers report it. */
  reasoning?: number;
  totalTokens: number;
  /** US dollars. */
  cost: UsageCost;
}

export const StopReason = {
  Stop: "stop",
  Length: "length",
  ToolUse: "toolUse",
  Error: "error",
  Aborted: "aborted",
} as const;

export type StopReason = (typeof StopReason)[keyof typeof StopReason];

export interface UserMessage {
  role: "user";
  content: string | TextContent[];
  timestamp: number;
}

export interface AssistantMessage {
  role: "assistant";
  content: (TextContent | ThinkingContent | ToolCallContent)[];
  /** The wire the reply came over; a thinking signature is only ever sent back to the same one. */
  api: string;
  provider: string;
  model: string;
  usage: Usage;
  stopReason: StopReason;
  /** The provider's or the host's text for a failed reply; logged, never shown. */
  errorMessage?: string;
  timestamp: number;
}

export interface ToolResultMessage {
  role: "toolResult";
  toolCallId: string;
  toolName: string;
  /** What the model read. */
  content: TextContent[];
  /** The tool's view model for clients; the model never reads it. */
  details?: JsonValue;
  isError: boolean;
  /** The operator declined the call, which never ran; `comment` is what they said. */
  declined?: { comment?: string };
  timestamp: number;
}

export type AgentMessage = UserMessage | AssistantMessage | ToolResultMessage;

export const emptyUsage = (): Usage => ({
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
});

interface ContentPartText {
  type: string;
  text?: string;
}

const isPartList = (
  content: string | readonly ContentPartText[]
): content is readonly ContentPartText[] => Array.isArray(content);

/** The text parts of a message's content, joined. */
export const contentText = (
  content: string | readonly ContentPartText[]
): string =>
  isPartList(content)
    ? content
        .filter((part) => part.type === "text")
        .map((part) => part.text ?? "")
        .join("")
    : content;
