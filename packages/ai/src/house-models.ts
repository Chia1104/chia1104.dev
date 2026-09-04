import type { ProviderId } from "./provider";

/**
 * Every model the house pays for, by role. Ids are gateway ids (`vendor/model`), the form
 * the Vercel AI Gateway and the AI SDK's default provider both accept.
 * Kinds and tasks reference a role, never an id; `agent.kind_config` and `agent.task_config`
 * override a role's default per deployment.
 */
export const HOUSE_MODELS = {
  /** One-shot side jobs: session titles, lesson extraction. */
  cheap: "anthropic/claude-haiku-4.5",
  /** Writing-agent sessions. */
  writing: "anthropic/claude-sonnet-5",
  /** Public-agent sessions without a caller key. */
  public: "anthropic/claude-haiku-4.5",
  /** The dash editor's content tools (slug, description, summary, excerpt, completion). */
  content: "anthropic/claude-sonnet-5",
} as const;

export type HouseModelRole = keyof typeof HOUSE_MODELS;

/** Cheapest native id per vendor, for checking that a caller's key works. */
export const KEY_PROBE_MODELS = {
  openai: "gpt-5-nano",
  anthropic: "claude-haiku-4-5",
} as const satisfies Readonly<Record<ProviderId, string>>;
