import * as z from "zod";

/**
 * The vendors a caller may bring a key for. Every place that spells a provider (cookies,
 * BYOK forms, model refs, icons) derives from this table.
 */
export const ProviderId = {
  OpenAI: "openai",
  Anthropic: "anthropic",
} as const;

export type ProviderId = (typeof ProviderId)[keyof typeof ProviderId];

export const PROVIDER_IDS = [
  ProviderId.OpenAI,
  ProviderId.Anthropic,
] as const satisfies readonly ProviderId[];

export const providerIdSchema = z.enum(PROVIDER_IDS);

export const isProviderId = (value: string): value is ProviderId =>
  /* SAFETY: The producer contract guarantees this value satisfies readonly string[]. */ (
    PROVIDER_IDS as readonly string[]
  ).includes(value);

export const PROVIDER_LABELS = {
  openai: "OpenAI",
  anthropic: "Anthropic",
} as const satisfies Readonly<Record<ProviderId, string>>;

/**
 * Cookie carrying the RSA-encrypted key `/ai/key:signed` writes. Names predate this table
 * and are kept so registered browsers stay registered.
 */
export const PROVIDER_COOKIE_NAMES = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
} as const satisfies Readonly<Record<ProviderId, string>>;
