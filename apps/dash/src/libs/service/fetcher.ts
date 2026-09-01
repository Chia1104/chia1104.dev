import { withServiceEndpoint } from "@chia/utils/config";
import { Service } from "@chia/utils/schema";

import { HonoRPCError } from "./error";

/**
 * Typed fetch for Hono endpoints that stay off oRPC (AI routes stream and set cookies).
 * Not `hc<AppRPC>`: that binds types to the whole server's route tree. Request/response types come from `@chia/ai`.
 */
const endpoint = (path: string) =>
  withServiceEndpoint(path, Service.LegacyService, {
    isInternal: false,
    version: "LEGACY",
  });

const post = async <TBody>(path: string, body: TBody): Promise<Response> => {
  let response: Response;

  try {
    response = await fetch(endpoint(path), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new HonoRPCError("unknown error", 500, "unknown error");
  }

  if (!response.ok) {
    throw new HonoRPCError(
      response.statusText,
      response.status,
      response.statusText
    );
  }

  return response;
};

export const postJson = async <TResult, TBody = object>(
  path: string,
  body: TBody
): Promise<TResult> => {
  const response = await post(path, body);
  return /* SAFETY: The producer contract guarantees this value satisfies TResult. */ (await response.json()) as TResult;
};

export interface TextStream {
  [Symbol.asyncIterator]: () => AsyncGenerator<string>;
  stream: ReadableStream<Uint8Array>;
}

export const postTextStream = async <TBody>(
  path: string,
  body: TBody
): Promise<TextStream> => {
  const response = await post(path, body);
  const stream = response.body;

  if (!stream) {
    throw new HonoRPCError(
      "Stream response body is undefined",
      500,
      "Stream response body is undefined"
    );
  }

  const decoder = new TextDecoder();

  return {
    async *[Symbol.asyncIterator]() {
      const reader = stream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          yield decoder.decode(value);
        }
      } finally {
        reader.releaseLock();
      }
    },
    stream,
  };
};
