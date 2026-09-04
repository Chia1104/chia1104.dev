import * as z from "zod";

/**
 * The model vendors. A model ref names one of these, and a caller may bring a native key for
 * either. Every place that spells a vendor (model refs, icons, cookies) derives from here.
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

/**
 * The Vercel AI Gateway reaches every vendor with one key. Not a vendor: a gateway key never
 * appears in a model ref, only in a credential set.
 */
export const GATEWAY_KEY_ID = "gateway";

/** Everything a caller may bring a key for: each vendor natively, or the gateway for all. */
export const KEY_IDS = [
  ...PROVIDER_IDS,
  GATEWAY_KEY_ID,
] as const satisfies readonly string[];

export type KeyId = (typeof KEY_IDS)[number];

export const keyIdSchema = z.enum(KEY_IDS);

export const isKeyId = (value: string): value is KeyId =>
  /* SAFETY: The producer contract guarantees this value satisfies readonly string[]. */ (
    KEY_IDS as readonly string[]
  ).includes(value);

export const KEY_LABELS = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gateway: "Vercel AI Gateway",
} as const satisfies Readonly<Record<KeyId, string>>;

/**
 * Cookie carrying the RSA-encrypted key `/ai/key:signed` writes. Vendor names predate this
 * table and are kept so registered browsers stay registered.
 */
export const KEY_COOKIE_NAMES = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  gateway: "AI_GATEWAY_API_KEY",
} as const satisfies Readonly<Record<KeyId, string>>;
