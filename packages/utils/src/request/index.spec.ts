import { HTTPError } from "ky";
import { describe, expect, it, vi } from "vitest";

import { postTextStream } from "./index.ts";

const encode = (text: string) => new TextEncoder().encode(text);

describe("postTextStream", () => {
  it("posts JSON and yields decoded chunks", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      const req = new Request(input, init);
      expect(req.method).toBe("POST");
      expect(await req.json()).toEqual({ prompt: "hi" });

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encode("hello"));
          controller.enqueue(encode(" world"));
          controller.close();
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    });

    const result = await postTextStream(
      "https://example.test/ai/generate",
      { prompt: "hi" },
      undefined,
      { fetch }
    );

    const chunks: string[] = [];
    for await (const chunk of result) {
      chunks.push(chunk);
    }

    expect(chunks.join("")).toBe("hello world");
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("throws HTTPError when the response is not ok", async () => {
    const fetch = vi.fn(async () => new Response("nope", { status: 401 }));

    await expect(
      postTextStream("https://example.test/ai/generate", {}, undefined, {
        fetch,
      })
    ).rejects.toBeInstanceOf(HTTPError);
  });
});
