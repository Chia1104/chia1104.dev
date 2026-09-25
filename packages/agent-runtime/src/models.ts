import { fromSpecTokenUsage } from "@tanstack/ai";
import type {
  AnyTextAdapter,
  RunErrorEvent,
  RunFinishedEvent,
  TokenUsage,
} from "@tanstack/ai";
import { ANTHROPIC_MODELS, createAnthropicChat } from "@tanstack/ai-anthropic";
import { createOpenaiChat, OPENAI_CHAT_MODELS } from "@tanstack/ai-openai";
import {
  createVercelGatewayText,
  VERCEL_GATEWAY_CHAT_MODELS,
  vercelGatewayText,
} from "@tanstack/ai-vercel-gateway";
import { minBy } from "es-toolkit";

import { listGatewayModels, tierPrice } from "@chia/ai/gateway";
import type { GatewayModel, GatewayModelPricing } from "@chia/ai/gateway";
import { HOUSE_MODELS } from "@chia/ai/house-models";
import type { HouseModelRole } from "@chia/ai/house-models";
import { KeyId, ProviderId } from "@chia/ai/provider";

import type { Usage } from "./messages.ts";
import { ThinkingLevel } from "./types.ts";

/**
 * Three providers, each its own wire and its own bill:
 *
 * - `vercel-ai-gateway`: reaches every vendor. Runs on the house key from the environment, or on
 *   a gateway key the caller brought.
 * - `openai` / `anthropic`: the vendor's own API, reachable only on a key the caller supplied.
 *   Never on an ambient key: a process may carry `OPENAI_API_KEY` for reasons of its own.
 *
 * A model ref names the provider, so it also names the wire and who pays. Nothing is inferred.
 */

export const AgentProvider = {
  Gateway: "vercel-ai-gateway",
  OpenAI: ProviderId.OpenAI,
  Anthropic: ProviderId.Anthropic,
} as const;

export type AgentProvider = (typeof AgentProvider)[keyof typeof AgentProvider];

/** Decrypted, request-scoped keys. Ciphertext is a transport concern; decrypted at the last moment. */
export type AgentCredentials = Partial<Record<KeyId, string>>;

/**
 * Which keys a caller holds, without the keys. What policy and listing see; a turn never
 * needs more than presence to decide who pays.
 */
export interface AgentModelAccess {
  /** The caller brought their own gateway key. */
  gateway: boolean;
  /** Vendors the caller brought a native key for. */
  native: readonly ProviderId[];
}

export const NO_ACCESS: AgentModelAccess = { gateway: false, native: [] };

/**
 * What an operator pinning a model for the house may reach: anything the gateway serves.
 * Never a caller's access; it would bill the house for their choice.
 */
export const HOUSE_ACCESS: AgentModelAccess = { gateway: true, native: [] };

/** Presence per key; ciphertext or plaintext, only presence is read. */
export const accessOf = (
  credentials: Partial<Record<KeyId, string>> | undefined
): AgentModelAccess => ({
  gateway: Boolean(credentials?.[KeyId.Gateway]),
  native: Object.values(ProviderId).filter((providerId) =>
    Boolean(credentials?.[providerId])
  ),
});

/** Identifies a model. Both halves are required. See {@link resolveModel}. */
export interface AgentModelRef {
  providerId: string;
  modelId: string;
}

/** A row's `(providerId, modelId)` pair, or nothing; the columns are written together. */
export const modelRefOf = (
  row: { providerId: string | null; modelId: string | null } | undefined
): AgentModelRef | null =>
  row?.providerId && row.modelId
    ? { providerId: row.providerId, modelId: row.modelId }
    : null;

/** The house-billed ref for a role; every house model runs through the gateway. */
export const houseModel = (role: HouseModelRole): AgentModelRef => ({
  providerId: AgentProvider.Gateway,
  modelId: HOUSE_MODELS[role],
});

export const sameModel = (a: AgentModelRef, b: AgentModelRef): boolean =>
  a.providerId === b.providerId && a.modelId === b.modelId;

/** A model the agent can run: its identity and what the gateway catalogue says about it. */
export interface AgentModel extends AgentModelRef {
  name: string;
  contextWindow: number;
  maxOutputTokens?: number;
  /** `null` when the model does not reason; empty when it takes only a token budget. */
  reasoningEfforts: readonly string[] | null;
  supportsTemperature: boolean;
  input: readonly string[];
  pricing: GatewayModelPricing;
}

/** Every model any provider can run, for one resolution; see {@link loadAgentCatalog}. */
export interface AgentCatalog {
  readonly models: readonly AgentModel[];
}

/** Whether an adapter package lists `id`, narrowed to the ids its factory takes. */
const isListed = <TId extends string>(
  ids: readonly TId[],
  id: string
): id is TId => ids.some((candidate) => candidate === id);

/** Dots and dashes are the only spelling difference between a gateway id and the vendor's own. */
const nativeKey = (id: string): string => id.toLowerCase().replaceAll(".", "-");

const fromGateway = (
  providerId: string,
  modelId: string,
  entry: GatewayModel
): AgentModel => ({
  providerId,
  modelId,
  name: entry.name,
  contextWindow: entry.contextWindow,
  maxOutputTokens: entry.maxOutputTokens,
  reasoningEfforts: entry.reasoningEfforts,
  supportsTemperature: entry.supportsTemperature,
  input: entry.input,
  pricing: entry.pricing,
});

/**
 * Native models borrow the gateway's description of the same model: the vendor packages list
 * ids but not windows or prices. A vendor id the gateway does not carry is not offered.
 */
const nativeModels = (
  providerId: ProviderId,
  ids: readonly string[],
  gateway: readonly GatewayModel[]
): AgentModel[] => {
  const byKey = new Map(
    gateway
      .filter((entry) => entry.id.startsWith(`${providerId}/`))
      .map((entry) => [nativeKey(entry.id.slice(providerId.length + 1)), entry])
  );
  return ids.flatMap((id) => {
    const entry = byKey.get(nativeKey(id));
    return entry ? [fromGateway(providerId, id, entry)] : [];
  });
};

/**
 * The gateway catalogue as each provider can serve it: gateway models its adapter knows, and
 * each vendor's own ids matched to the gateway's description. The gateway list is cached per
 * process, so a caller may load this per request.
 */
export const loadAgentCatalog = async (): Promise<AgentCatalog> => {
  const gateway = await listGatewayModels();
  return {
    models: [
      ...gateway
        .filter((entry) => isListed(VERCEL_GATEWAY_CHAT_MODELS, entry.id))
        .map((entry) => fromGateway(AgentProvider.Gateway, entry.id, entry)),
      ...nativeModels(ProviderId.OpenAI, OPENAI_CHAT_MODELS, gateway),
      ...nativeModels(ProviderId.Anthropic, ANTHROPIC_MODELS, gateway),
    ],
  };
};

/** A kind's policy: whether it admits `ref` for a caller holding `access`. */
export type AgentModelPredicate = (
  ref: AgentModelRef,
  access: AgentModelAccess
) => boolean;

/** Whether the caller holds a key that opens `providerId`; the gateway always has the house's. */
const holdsKeyFor = (providerId: string, access: AgentModelAccess): boolean =>
  providerId === AgentProvider.Gateway ||
  access.native.some((held) => held === providerId);

export class UnknownAgentModelError extends Error {
  constructor(readonly ref: AgentModelRef) {
    super(
      `Model "${ref.modelId}" on provider "${ref.providerId}" is not available to this agent.`
    );
    this.name = "UnknownAgentModelError";
  }
}

/**
 * Resolves a `(providerId, modelId)` pair against a predicate owned by the agent kind.
 *
 * The pair is the identity, never the model id alone: the same model carries different ids
 * under different providers. `anthropic/claude-haiku-4.5` through the gateway is
 * `claude-haiku-4-5` natively.
 *
 * The predicate is policy: which models an agent may use for this caller. Pairs outside it
 * are rejected even when the provider would serve them, because the pair arrives from a
 * client-supplied setting. Whether the caller holds a native model's key is decided when the
 * model is bound, so whether a model exists never depends on the keys a caller registered.
 */
export const resolveModel = (
  ref: AgentModelRef,
  isAllowed: AgentModelPredicate,
  catalog: AgentCatalog,
  access: AgentModelAccess
): AgentModel => {
  if (!isAllowed(ref, access)) throw new UnknownAgentModelError(ref);
  const model = catalog.models.find((candidate) => sameModel(candidate, ref));
  if (!model) throw new UnknownAgentModelError(ref);
  return model;
};

export interface AgentModelInfo {
  providerId: string;
  modelId: string;
  name: string;
  contextWindow: number;
  supportsReasoning: boolean;
  supportsImageInput: boolean;
  /** True when the caller cannot use this model until they register a key. */
  requiresApiKey: boolean;
}

/**
 * Every model in the catalogue, each marked with whether the caller can use it now. Refused
 * models are listed rather than hidden: hiding them would leave no way to discover that
 * registering a key unlocks them.
 */
export const listModels = (
  isAllowed: AgentModelPredicate,
  catalog: AgentCatalog,
  access: AgentModelAccess = NO_ACCESS
): AgentModelInfo[] =>
  catalog.models.map((model) => ({
    providerId: model.providerId,
    modelId: model.modelId,
    name: model.name,
    contextWindow: model.contextWindow,
    supportsReasoning: model.reasoningEfforts !== null,
    supportsImageInput: model.input.includes("image"),
    requiresApiKey: !(
      isAllowed(model, access) && holdsKeyFor(model.providerId, access)
    ),
  }));

/**
 * The provider options a binding sends, in each API's own spelling: `reasoning` for the
 * OpenAI-shaped wires, `thinking` and `cache_control` for Anthropic's.
 */
export interface AgentModelOptions {
  reasoning?: { effort: string; summary: "auto" };
  gateway?: { caching: "auto" };
  thinking?: { type: "disabled" } | { type: "enabled"; budget_tokens: number };
  cache_control?: { type: "ephemeral" };
  temperature?: number;
  max_tokens?: number;
  max_output_tokens?: number;
}

/** A resolved model bound to the adapter and options that run it for one caller. */
export interface AgentModelBinding {
  model: AgentModel;
  adapter: AnyTextAdapter;
  /**
   * The wire the adapter speaks. A thinking signature is only ever sent back to the same wire;
   * `AssistantMessage.api` records it.
   */
  api: string;
  modelOptions: AgentModelOptions;
  /** Whether the adapter's `promptTokens` already counts cache reads and writes. */
  promptTokensIncludeCache: boolean;
}

const THINKING_ORDER: readonly ThinkingLevel[] = [
  ThinkingLevel.Off,
  ThinkingLevel.Minimal,
  ThinkingLevel.Low,
  ThinkingLevel.Medium,
  ThinkingLevel.High,
  ThinkingLevel.XHigh,
  ThinkingLevel.Max,
];

/** Efforts the OpenAI-shaped `reasoning` parameter takes when the catalogue names none. */
const DEFAULT_EFFORTS = ["low", "medium", "high"] as const;

/**
 * The effort a model accepts closest to `level`, preferring the lower on a tie: a level the
 * model cannot express never buys more reasoning than was asked for.
 */
const effortFor = (
  level: ThinkingLevel,
  efforts: readonly string[]
): string | undefined => {
  const rank = THINKING_ORDER.indexOf(level);
  const offered = efforts.length > 0 ? efforts : DEFAULT_EFFORTS;
  const candidates = offered.flatMap((effort) => {
    const effortRank = THINKING_ORDER.findIndex(
      (candidate) =>
        candidate === effort || (effort === "none" && candidate === "off")
    );
    return effortRank === -1 ? [] : [{ effort, rank: effortRank }];
  });
  // Ranks are whole numbers, so the half step only breaks ties, toward the lower effort.
  return minBy(
    candidates,
    (candidate) =>
      Math.abs(candidate.rank - rank) + (candidate.rank > rank ? 0.5 : 0)
  )?.effort;
};

/** OpenAI-shaped reasoning options; `off` sends nothing when the model has no `none` effort. */
const reasoningOptions = (
  model: AgentModel,
  level: ThinkingLevel
): Pick<AgentModelOptions, "reasoning"> => {
  if (model.reasoningEfforts === null) return {};
  if (level === ThinkingLevel.Off && !model.reasoningEfforts.includes("none")) {
    return {};
  }
  const effort = effortFor(level, model.reasoningEfforts);
  return effort ? { reasoning: { effort, summary: "auto" } } : {};
};

/** Anthropic's extended-thinking budget per level; the API's floor is 1024. */
const ANTHROPIC_THINKING_BUDGET = {
  [ThinkingLevel.Off]: 0,
  [ThinkingLevel.Minimal]: 1024,
  [ThinkingLevel.Low]: 2048,
  [ThinkingLevel.Medium]: 8192,
  [ThinkingLevel.High]: 16384,
  [ThinkingLevel.XHigh]: 24576,
  [ThinkingLevel.Max]: 32000,
} as const satisfies Record<ThinkingLevel, number>;

/**
 * Binds `model` to the adapter that runs it on the caller's credentials. A native model without
 * the caller's key cannot be bound: {@link resolveModel} refuses it first.
 */
export const bindModel = (
  model: AgentModel,
  credentials: AgentCredentials,
  thinkingLevel: ThinkingLevel
): AgentModelBinding => {
  const { providerId, modelId } = model;

  if (
    providerId === AgentProvider.Gateway &&
    isListed(VERCEL_GATEWAY_CHAT_MODELS, modelId)
  ) {
    const key = credentials[KeyId.Gateway];
    return {
      model,
      adapter: key
        ? createVercelGatewayText(modelId, key)
        : vercelGatewayText(modelId),
      api: "vercel-gateway:responses",
      modelOptions: {
        ...reasoningOptions(model, thinkingLevel),
        // Anthropic models cache nothing through the gateway unless it is asked to mark the prefix.
        gateway: { caching: "auto" },
      },
      promptTokensIncludeCache: true,
    };
  }

  const nativeKeyOf =
    credentials[
      providerId === ProviderId.OpenAI ? KeyId.OpenAI : KeyId.Anthropic
    ];
  if (
    providerId === ProviderId.OpenAI &&
    isListed(OPENAI_CHAT_MODELS, modelId) &&
    nativeKeyOf
  ) {
    return {
      model,
      adapter: createOpenaiChat(modelId, nativeKeyOf),
      api: "openai:responses",
      modelOptions: reasoningOptions(model, thinkingLevel),
      promptTokensIncludeCache: true,
    };
  }

  if (
    providerId === ProviderId.Anthropic &&
    isListed(ANTHROPIC_MODELS, modelId) &&
    nativeKeyOf
  ) {
    const budget = ANTHROPIC_THINKING_BUDGET[thinkingLevel];
    return {
      model,
      adapter: createAnthropicChat(modelId, nativeKeyOf),
      api: "anthropic:messages",
      modelOptions: {
        cache_control: { type: "ephemeral" },
        thinking:
          model.reasoningEfforts === null || budget === 0
            ? { type: "disabled" }
            : { type: "enabled", budget_tokens: budget },
      },
      promptTokensIncludeCache: false,
    };
  }

  throw new UnknownAgentModelError(model);
};

export interface SamplingParams {
  maxTokens?: number;
  temperature?: number;
}

/** Sampling in the spelling the binding's API takes; a temperature the model refuses is dropped. */
export const samplingOptions = (
  binding: Pick<AgentModelBinding, "api" | "model">,
  params: SamplingParams
): Pick<
  AgentModelOptions,
  "temperature" | "max_tokens" | "max_output_tokens"
> => {
  const temperature =
    params.temperature !== undefined && binding.model.supportsTemperature
      ? { temperature: params.temperature }
      : {};
  const maxTokens =
    params.maxTokens === undefined
      ? {}
      : binding.api === "anthropic:messages"
        ? { max_tokens: params.maxTokens }
        : { max_output_tokens: params.maxTokens };
  return { ...temperature, ...maxTokens };
};

/** The in-process usage object; the AG-UI `usage[]` spelling is only for the public wire. */
export const tokenUsageOf = (
  chunk: Pick<RunFinishedEvent | RunErrorEvent, "usage">
): TokenUsage | undefined =>
  Array.isArray(chunk.usage) ? fromSpecTokenUsage(chunk.usage) : chunk.usage;

/**
 * The call's usage in the transcript's terms, priced from the catalogue. `input` excludes cache
 * reads and writes whichever way the adapter counts them.
 */
export const usageOf = (
  binding: Pick<AgentModelBinding, "model" | "promptTokensIncludeCache">,
  usage: TokenUsage
): Usage => {
  const cacheRead = usage.promptTokensDetails?.cachedTokens ?? 0;
  const cacheWrite = usage.promptTokensDetails?.cacheWriteTokens ?? 0;
  const input = binding.promptTokensIncludeCache
    ? Math.max(0, usage.promptTokens - cacheRead - cacheWrite)
    : usage.promptTokens;
  const output = usage.completionTokens;
  const promptTokens = input + cacheRead + cacheWrite;
  const { pricing } = binding.model;
  const cost = {
    input: input * tierPrice(pricing.input, promptTokens),
    output: output * tierPrice(pricing.output, promptTokens),
    cacheRead: cacheRead * tierPrice(pricing.cacheRead, promptTokens),
    cacheWrite: cacheWrite * tierPrice(pricing.cacheWrite, promptTokens),
  };
  return {
    input,
    output,
    cacheRead,
    cacheWrite,
    reasoning: usage.completionTokensDetails?.reasoningTokens,
    totalTokens: promptTokens + output,
    cost: {
      ...cost,
      total: cost.input + cost.output + cost.cacheRead + cost.cacheWrite,
    },
  };
};
