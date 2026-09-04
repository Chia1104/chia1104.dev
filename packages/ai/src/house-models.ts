import type { KeyId } from "./provider";

/**
 * Every model the house pays for, by role. Ids are gateway ids (`vendor/model`), the form
 * the Vercel AI Gateway and the AI SDK's default provider both accept.
 * Kinds and tasks reference a role, never an id; `agent.kind_config` and `agent.task_config`
 * override a role's default per deployment.
 */
export const HOUSE_MODELS = {
  /** One-shot side jobs: session titles, lesson extraction. */
  cheap: "openai/gpt-5.6-luna",
  /** Writing-agent sessions. */
  writing: "openai/gpt-5.6-luna",
  /** Public-agent sessions without a caller key. */
  public: "openai/gpt-5.6-luna",
  /** The dash editor's content tools (slug, description, summary, excerpt, completion). */
  content: "openai/gpt-5.6-luna",
} as const;

export type HouseModelRole = keyof typeof HOUSE_MODELS;

/** A cheap model per key, spelled as that key's API wants it, for checking that the key works. */
export const KEY_PROBE_MODELS = {
  openai: "openai/gpt-5.6-luna",
  anthropic: "claude-haiku-4-5",
  gateway: HOUSE_MODELS.cheap,
} as const satisfies Readonly<Record<KeyId, string>>;
