import { createAnthropic } from "@ai-sdk/anthropic";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { streamText } from "ai";

import type { BaseRequest } from "../utils/types";
import { Provider } from "../utils/types";

/**
 * @deprecated Use `request.system` instead
 */
export const DEFAULT_SYSTEM_PROMPT =
  "You are an AI writing assistant that continues existing text based on context from prior text. " +
  "Give more weight/priority to the later characters than the beginning ones. " +
  "Limit your response to no more than 200 characters, but make sure to construct complete sentences." +
  "Use Markdown formatting when appropriate.";

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
    case Provider.DeepSeek:
      return createDeepSeek({
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
    messages: request.messages,
  });
