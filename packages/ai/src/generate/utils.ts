import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { streamText } from "ai";

import type { BaseRequest } from "../utils/types";
import { Provider } from "../utils/types";

type Options = Omit<
  Parameters<typeof streamText>[0],
  "messages" | "model" | "system" | "prompt"
>;

export const createModel = (request: BaseRequest): LanguageModel => {
  switch (request.model.provider) {
    case Provider.OpenAI:
      return createOpenAI({
        apiKey: request.authToken,
        baseURL: request.proxyUrl,
      })(request.model.id);
    case Provider.Anthropic:
      return createAnthropic({
        apiKey: request.authToken,
        baseURL: request.proxyUrl,
      })(request.model.id);
    case Provider.Google:
      return createGoogleGenerativeAI({
        apiKey: request.authToken,
        baseURL: request.proxyUrl,
      })(request.model.id);
    default:
      throw new Error("Invalid provider");
  }
};

export const streamGeneratedText = (
  request: BaseRequest,
  options?: Partial<Options>
) =>
  streamText({
    ...options,
    model: createModel(request),
    system: request.system,
    messages: request.messages ?? [],
  });
