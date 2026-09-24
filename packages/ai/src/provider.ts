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

export const providerIdSchema = z.enum(ProviderId);

export const isProviderId = (value: string): value is ProviderId =>
  Object.values(ProviderId).some((providerId) => providerId === value);

/**
 * Everything a caller may bring a key for: each vendor natively, or the Vercel AI Gateway for
 * all. The gateway is not a vendor: its key never appears in a model ref, only in a credential set.
 */
export const KeyId = {
  ...ProviderId,
  Gateway: "gateway",
} as const;

export type KeyId = (typeof KeyId)[keyof typeof KeyId];

export const keyIdSchema = z.enum(KeyId);

export const isKeyId = (value: string): value is KeyId =>
  Object.values(KeyId).some((keyId) => keyId === value);

export const KEY_LABELS = {
  [KeyId.OpenAI]: "OpenAI",
  [KeyId.Anthropic]: "Anthropic",
  [KeyId.Gateway]: "Vercel AI Gateway",
} as const satisfies Readonly<Record<KeyId, string>>;

/**
 * Cookie carrying the RSA-encrypted key `/ai/key:signed` writes. Vendor names predate this
 * table and are kept so registered browsers stay registered.
 */
export const KEY_COOKIE_NAMES = {
  [KeyId.OpenAI]: "OPENAI_API_KEY",
  [KeyId.Anthropic]: "ANTHROPIC_API_KEY",
  [KeyId.Gateway]: "AI_GATEWAY_API_KEY",
} as const satisfies Readonly<Record<KeyId, string>>;
