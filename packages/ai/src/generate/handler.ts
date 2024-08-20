import { createOpenAI } from "@ai-sdk/openai";
import { convertToCoreMessages, streamText, APICallError } from "ai";
import { JsonWebTokenError } from "jsonwebtoken";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { errorGenerator, ParsedJSONError } from "@chia/utils";

import { verifyApiKey } from "../utils";
import { HEADER_AUTH_TOKEN } from "../utils/constants";
import { baseRequestSchema } from "../utils/types";
import { DEFAULT_SYSTEM_PROMPT } from "./utils";

/**
 * Allow streaming responses up to 30 seconds
 * @example
 * ```ts
 * export { maxDuration } from "@chia/ai/generate/handler"
 * ```
 */
export const maxDuration = 30;

export const POST = async (req: NextRequest) => {
  try {
    if (!process.env.AI_AUTH_SECRET || process.env.AI_AUTH_SECRET === "") {
      return NextResponse.json(errorGenerator(503), {
        status: 503,
        headers: {
          "retry-after": "3600", // retry after 1 hour
        },
      });
    }

    const json = req.json().catch(() => {
      throw new ParsedJSONError(
        errorGenerator(400, [
          {
            field: "body",
            message: "Invalid JSON body",
          },
        ])
      );
    });

    const request = baseRequestSchema.parse({
      ...(await json),
      authToken: verifyApiKey(
        req.headers.get(HEADER_AUTH_TOKEN) ??
          cookies().get(HEADER_AUTH_TOKEN)?.value ??
          "",
        process.env.AI_AUTH_SECRET
      ).apiKey,
    });

    return (
      await streamText({
        model: createOpenAI({
          apiKey: request.authToken,
        })(request.modal),
        system: DEFAULT_SYSTEM_PROMPT,
        messages: convertToCoreMessages(request.messages),
      })
    ).toDataStreamResponse();
  } catch (error) {
    if (error instanceof ParsedJSONError) {
      return NextResponse.json(errorGenerator(400, error.error.errors), {
        status: 400,
      });
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
    if (error instanceof JsonWebTokenError) {
      return NextResponse.json(errorGenerator(403), {
        status: 403,
      });
    }
    if (error instanceof APICallError) {
      return NextResponse.json(
        errorGenerator(400, [
          {
            field: "api_call",
            message:
              "Failed to call OpenAI API, please check your api settings",
          },
        ]),
        {
          status: 400,
        }
      );
    }
    console.error(error);
    return NextResponse.json(errorGenerator(500), {
      status: 500,
    });
  }
};
