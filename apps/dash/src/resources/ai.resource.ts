import type { InferResponseType, InferRequestType } from "hono";

import type { Provider } from "@chia/ai/types";

import { client } from "@/libs/service/client";
import { HonoRPCError } from "@/libs/service/error";

export type SignAIKeyResponse = InferResponseType<
  (typeof client.api.v1.ai)["key:signed"]["$post"],
  200
>;

export type GenerateAIContentResponse = InferResponseType<
  (typeof client.api.v1.ai)["generate"]["$post"],
  200
>;

export type GenerateAIContentInput = InferRequestType<
  (typeof client.api.v1.ai)["generate"]["$post"]
>;

export const getSignedAIKey = async (apiKey: string, provider: Provider) => {
  try {
    const response = await client.api.v1.ai["key:signed"].$post({
      json: {
        apiKey,
        provider,
      },
    });
    if (!response.ok) {
      throw new HonoRPCError(
        response.statusText,
        response.status,
        response.statusText
      );
    }
    return response.json();
  } catch (error) {
    if (error instanceof HonoRPCError) {
      throw error;
    }
    throw new HonoRPCError("unknown error", 500, "unknown error");
  }
};

export const generateAIContent = async (
  input: GenerateAIContentInput["json"]
) => {
  try {
    const response = await client.api.v1.ai.generate.$post({
      json: input,
    });

    if (!response.ok) {
      throw new HonoRPCError(
        response.statusText,
        response.status,
        response.statusText
      );
    }

    const body = response.body;
    if (!body)
      throw new HonoRPCError(
        "Stream response body is undefined",
        500,
        "Stream response body is undefined"
      );

    const decoder = new TextDecoder();

    return {
      [Symbol.asyncIterator]: async function* () {
        const reader = body.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            yield chunk;
          }
        } finally {
          reader.releaseLock();
        }
      },
      stream: body,
    };
  } catch (error) {
    if (error instanceof HonoRPCError) {
      throw error;
    }
    throw new HonoRPCError("unknown error", 500, "unknown error");
  }
};
