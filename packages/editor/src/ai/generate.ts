import { openai } from "@ai-sdk/openai";
import { convertToCoreMessages, streamText } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@chia/auth";
import { errorGenerator, getAdminId, ParsedJSONError } from "@chia/utils";

/**
 * Allow streaming responses up to 30 seconds
 * @example
 * ```ts
 * export { maxDuration } from "@chia/editor/ai/generate"
 * ```
 */
export const maxDuration = 30;

// https://platform.openai.com/docs/models
export const OpenAIModal = {
  "gpt-4o": "gpt-4o",
  "gpt-4": "gpt-4",
  "gpt-3.5-turbo": "gpt-3.5-turbo",
} as const;

export type OpenAIModal = (typeof OpenAIModal)[keyof typeof OpenAIModal];

export const requestSchema = z.object({
  prompt: z.string(),
  modal: z.nativeEnum(OpenAIModal).optional().default(OpenAIModal["gpt-4o"]),
});

export type RequestDTO = z.infer<typeof requestSchema>;

export const POST = auth(async (req) => {
  try {
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "") {
      return NextResponse.json(errorGenerator(503), {
        status: 503,
        headers: {
          "retry-after": "3600", // retry after 1 hour
        },
      });
    }

    if (!req.auth || req.auth.user?.id !== getAdminId()) {
      return NextResponse.json(
        errorGenerator(403, [
          {
            field: "auth",
            message: "You are not authorized to access this resource.",
          },
        ]),
        {
          status: 403,
        }
      );
    }

    const json = req.json().catch(() => {
      throw new ParsedJSONError(errorGenerator(400));
    });

    const request = requestSchema.parse(await json);

    const result = await streamText({
      model: openai(request.modal),
      messages: convertToCoreMessages([
        {
          role: "system",
          content:
            "You are an AI writing assistant that continues existing text based on context from prior text. " +
            "Give more weight/priority to the later characters than the beginning ones. " +
            "Limit your response to no more than 200 characters, but make sure to construct complete sentences." +
            "Use Markdown formatting when appropriate.",
        },
        {
          role: "user",
          content: request.prompt,
        },
      ]),
    });

    return result.toDataStreamResponse();
  } catch (error) {
    if (error instanceof ParsedJSONError) {
      return NextResponse.json(
        errorGenerator(400, [
          {
            field: "body",
            message: "Invalid JSON body.",
          },
        ]),
        {
          status: 400,
        }
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        errorGenerator(
          400,
          error.issues.map((issue) => {
            return {
              field: issue.path.join("."),
              message: issue.message,
            };
          })
        ),
        {
          status: 400,
        }
      );
    }
    return NextResponse.json(errorGenerator(500), {
      status: 500,
    });
  }
});
