import { createAnthropic } from "@ai-sdk/anthropic";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { convertToCoreMessages, streamText } from "ai";

import { Provider } from "../utils/types";
import type { BaseRequest } from "../utils/types";

export const DEFAULT_SYSTEM_PROMPT =
  "You are an AI writing assistant that continues existing text based on context from prior text. " +
  "Give more weight/priority to the later characters than the beginning ones. " +
  "Limit your response to no more than 200 characters, but make sure to construct complete sentences." +
  "Use Markdown formatting when appropriate.";

type Options = Parameters<typeof streamText>[0];

export const createModel = (request: BaseRequest) => {
  switch (request.model.provider) {
    case Provider.OpenAI:
      return createOpenAI({
        apiKey: request.authToken,
      })(request.model.id);
    case Provider.Anthropic:
      return createAnthropic({
        apiKey: request.authToken,
      })(request.model.id);
    case Provider.Google:
      return createGoogleGenerativeAI({
        apiKey: request.authToken,
      })(request.model.id);
    case Provider.DeepSeek:
      return createDeepSeek({
        apiKey: request.authToken,
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
    model: createModel(request),
    system: request.system ?? DEFAULT_SYSTEM_PROMPT,
    messages: convertToCoreMessages(request.messages),
    ...options,
  });
