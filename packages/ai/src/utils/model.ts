import { createAnthropic } from "@ai-sdk/anthropic";
import { createGateway } from "@ai-sdk/gateway";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

import { KeyId, ProviderId } from "../provider";

import type { BaseRequest } from "./types";

/**
 * Kept out of `@chia/ai/utils` because that module is on the request-auth
 * path: the API-key guards import `verifyApiKey` from it. Sharing a module
 * with the provider SDKs would put them in the eager graph of every process
 * that authenticates a request.
 */
export const createModel = (
  options: Pick<BaseRequest, "model" | "authToken">
): LanguageModel => {
  switch (options.model.provider) {
    case ProviderId.OpenAI:
      return createOpenAI({ apiKey: options.authToken })(options.model.id);
    case ProviderId.Anthropic:
      return createAnthropic({ apiKey: options.authToken })(options.model.id);
    case KeyId.Gateway:
      return createGateway({ apiKey: options.authToken })(options.model.id);
    default: {
      const _exhaustive: never = options.model.provider;
      return _exhaustive;
    }
  }
};
