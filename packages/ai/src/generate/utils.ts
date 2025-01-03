import { createOpenAI } from "@ai-sdk/openai";
import { convertToCoreMessages, streamText } from "ai";

import type { BaseRequest } from "../utils/types";

export const DEFAULT_SYSTEM_PROMPT =
  "You are an AI writing assistant that continues existing text based on context from prior text. " +
  "Give more weight/priority to the later characters than the beginning ones. " +
  "Limit your response to no more than 200 characters, but make sure to construct complete sentences." +
  "Use Markdown formatting when appropriate.";

type Options = Parameters<typeof streamText>[0];

export const streamGeneratedText = (
  request: BaseRequest,
  oprions?: Partial<Options>
) =>
  streamText({
    model: createOpenAI({
      apiKey: request.authToken,
    })(request.modal),
    system: request.system ?? DEFAULT_SYSTEM_PROMPT,
    messages: convertToCoreMessages(request.messages),
    ...oprions,
  });
