import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

import type { BaseRequest } from "./types";
import { Provider } from "./types";

/**
 * Kept out of `@chia/ai/utils` because that module is on the request-auth
 * path: the API-key guards import `verifyApiKey` from it. Sharing a module
 * with these three provider SDKs would put all of them in the eager graph
 * of every process that authenticates a request.
 */
export const createModel = (
  options: Pick<BaseRequest, "model" | "authToken" | "proxyUrl">,
  formater?: ((model: BaseRequest["model"]) => LanguageModel) | "ai-gateway-v3"
): LanguageModel => {
  if (formater) {
    if (formater instanceof Function) {
      return formater(options.model);
    }
    switch (formater) {
      case "ai-gateway-v3":
        return `${options.model.provider}/${options.model.id}`;
      default:
        throw new Error("Invalid formater");
    }
  }
  switch (options.model.provider) {
    case Provider.OpenAI:
      return createOpenAI({
        apiKey: options.authToken,
        baseURL: options.proxyUrl,
      })(options.model.id);
    case Provider.Anthropic:
      return createAnthropic({
        apiKey: options.authToken,
        baseURL: options.proxyUrl,
      })(options.model.id);
    case Provider.Google:
      return createGoogleGenerativeAI({
        apiKey: options.authToken,
        baseURL: options.proxyUrl,
      })(options.model.id);
    default:
      throw new Error("Invalid provider");
  }
};
