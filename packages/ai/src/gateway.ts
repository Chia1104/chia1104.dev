import * as z from "zod";

import { logger } from "@chia/observability/logger";

/**
 * The Vercel AI Gateway's public model catalogue: context windows, modalities, reasoning
 * controls and prices for every model it serves. Read at runtime rather than pinned in a
 * package release, so a model or price the gateway changes reaches the agent without a deploy.
 */

const GATEWAY_MODELS_URL = "https://ai-gateway.vercel.sh/v1/models";

/** Prices and limits move rarely; an hour bounds how stale a caller's view can be. */
const CATALOGUE_TTL_MS = 60 * 60 * 1000;

const CATALOGUE_TIMEOUT_MS = 10_000;

/** Dollars per token from the gateway's decimal strings. */
const priceSchema = z.coerce.number().nonnegative();

const tierSchema = z.object({
  cost: priceSchema,
  min: z.number().int().nonnegative(),
});

const pricingSchema = z
  .object({
    input: priceSchema.optional(),
    output: priceSchema.optional(),
    input_cache_read: priceSchema.optional(),
    input_cache_write: priceSchema.optional(),
    input_tiers: z.array(tierSchema).optional(),
    output_tiers: z.array(tierSchema).optional(),
    input_cache_read_tiers: z.array(tierSchema).optional(),
    input_cache_write_tiers: z.array(tierSchema).optional(),
  })
  .loose();

const reasoningOptionSchema = z
  .object({
    type: z.string(),
    values: z.array(z.string()).optional(),
  })
  .loose();

const gatewayModelSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    type: z.string(),
    context_window: z.number().int().positive(),
    max_tokens: z.number().int().positive().optional(),
    modalities: z
      .object({ input: z.array(z.string()), output: z.array(z.string()) })
      .optional(),
    reasoning_options: z.array(reasoningOptionSchema).optional(),
    temperature: z.boolean().optional(),
    pricing: pricingSchema,
  })
  .loose();

const catalogueSchema = z.object({ data: z.array(z.unknown()) });

/** A per-token price that steps up once the prompt reaches `minTokens`; sorted ascending. */
export interface GatewayPriceTier {
  perToken: number;
  minTokens: number;
}

export interface GatewayModelPricing {
  input: readonly GatewayPriceTier[];
  output: readonly GatewayPriceTier[];
  cacheRead: readonly GatewayPriceTier[];
  cacheWrite: readonly GatewayPriceTier[];
}

export interface GatewayModel {
  /** `vendor/model`, as the gateway routes it. */
  id: string;
  name: string;
  contextWindow: number;
  maxOutputTokens?: number;
  input: readonly string[];
  /**
   * `null` when the model does not reason. Otherwise the effort names it accepts; empty when
   * it only takes a token budget.
   */
  reasoningEfforts: readonly string[] | null;
  /** Reasoning models without a sampling temperature refuse the parameter. */
  supportsTemperature: boolean;
  pricing: GatewayModelPricing;
}

const tiersOf = (
  base: number | undefined,
  tiers: readonly z.infer<typeof tierSchema>[] | undefined
): GatewayPriceTier[] =>
  tiers && tiers.length > 0
    ? tiers
        .map((tier) => ({ perToken: tier.cost, minTokens: tier.min }))
        .sort((a, b) => a.minTokens - b.minTokens)
    : base === undefined
      ? []
      : [{ perToken: base, minTokens: 0 }];

const toGatewayModel = (
  raw: z.infer<typeof gatewayModelSchema>
): GatewayModel => {
  const reasoning = raw.reasoning_options;
  return {
    id: raw.id,
    name: raw.name,
    contextWindow: raw.context_window,
    maxOutputTokens: raw.max_tokens,
    input: raw.modalities?.input ?? ["text"],
    reasoningEfforts:
      reasoning && reasoning.length > 0
        ? reasoning.flatMap((option) =>
            option.type === "effort" ? (option.values ?? []) : []
          )
        : null,
    supportsTemperature: raw.temperature ?? true,
    pricing: {
      input: tiersOf(raw.pricing.input, raw.pricing.input_tiers),
      output: tiersOf(raw.pricing.output, raw.pricing.output_tiers),
      cacheRead: tiersOf(
        raw.pricing.input_cache_read,
        raw.pricing.input_cache_read_tiers
      ),
      cacheWrite: tiersOf(
        raw.pricing.input_cache_write,
        raw.pricing.input_cache_write_tiers
      ),
    },
  };
};

let cached: { at: number; models: GatewayModel[] } | undefined;
let loading: Promise<GatewayModel[]> | undefined;

const fetchCatalogue = async (): Promise<GatewayModel[]> => {
  const response = await fetch(GATEWAY_MODELS_URL, {
    signal: AbortSignal.timeout(CATALOGUE_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(
      `The AI Gateway model catalogue answered ${response.status}.`
    );
  }
  // Language models only; an entry the schema cannot read is skipped rather than failing the list.
  const models = catalogueSchema
    .parse(await response.json())
    .data.flatMap((entry) => {
      const parsed = gatewayModelSchema.safeParse(entry);
      return parsed.success && parsed.data.type === "language"
        ? [toGatewayModel(parsed.data)]
        : [];
    });
  cached = { at: Date.now(), models };
  return models;
};

/**
 * The catalogue, fetched at most once an hour per process. A failed refresh keeps serving the
 * last good copy; with none to serve, the failure reaches the caller.
 */
export const listGatewayModels = async (): Promise<GatewayModel[]> => {
  if (cached && Date.now() - cached.at < CATALOGUE_TTL_MS) {
    return cached.models;
  }
  loading ??= fetchCatalogue().finally(() => {
    loading = undefined;
  });
  try {
    return await loading;
  } catch (error) {
    if (!cached) throw error;
    logger.warn(
      { err: error },
      "AI Gateway catalogue refresh failed; serving the previous copy"
    );
    return cached.models;
  }
};

/** The per-token price that applies to a prompt of `promptTokens`; `0` when the model lists none. */
export const tierPrice = (
  tiers: readonly GatewayPriceTier[],
  promptTokens: number
): number =>
  tiers.findLast((tier) => promptTokens >= tier.minTokens)?.perToken ??
  tiers[0]?.perToken ??
  0;
