import { context, SpanStatusCode, trace } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as z from "zod";

import { complete } from "../src/complete.ts";
import { bindingOf, scriptedAdapter } from "../src/testing.ts";
import { defineTool } from "../src/tools.ts";

import { build, toolCall } from "./runtime.fixture.ts";

const exporter = new InMemorySpanExporter();

beforeAll(() => {
  context.setGlobalContextManager(
    new AsyncLocalStorageContextManager().enable()
  );
  trace.setGlobalTracerProvider(
    new BasicTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(exporter)],
    })
  );
});

afterAll(() => {
  trace.disable();
  context.disable();
});

beforeEach(() => {
  exporter.reset();
});

const spansNamed = (prefix: string) =>
  exporter.getFinishedSpans().filter((span) => span.name.startsWith(prefix));

const leak = defineTool(
  {
    name: "leak",
    description: "Fails with the operator's text.",
    parameters: z.object({}),
  },
  () => () => Promise.reject(new TypeError("draft: my private note"))
)({});

/** Everything a span exports besides its name and ids. */
const exportedOf = (span: ReturnType<typeof spansNamed>[number] | undefined) =>
  JSON.stringify([span?.attributes, span?.events, span?.status]);

describe("agent turn telemetry", () => {
  it("nests the model and tool spans under the turn", async () => {
    const fixture = build([
      toolCall("search", { q: "hono" }, "call-1"),
      { text: "Found it." },
    ]);

    const result = await fixture.run({ agentRunId: "run-1" });

    expect(result.status).toBe("done");
    const [turn] = spansNamed("invoke_agent");
    expect(turn?.attributes).toMatchObject({
      "gen_ai.operation.name": "invoke_agent",
      "gen_ai.conversation.id": "session-1",
      "agent.run_id": "run-1",
      "gen_ai.provider.name": "scripted",
      "gen_ai.request.model": "test-model",
      "agent.turn.status": "done",
    });

    const chats = spansNamed("chat ");
    expect(chats).toHaveLength(2);
    for (const chat of chats) {
      expect(chat.parentSpanContext?.spanId).toBe(turn?.spanContext().spanId);
      expect(chat.attributes).toMatchObject({
        "gen_ai.operation.name": "chat",
        "gen_ai.request.model": "test-model",
        "gen_ai.usage.input_tokens": 100,
        "gen_ai.usage.output_tokens": 10,
      });
    }
    expect(
      chats.map((chat) => chat.attributes["gen_ai.response.finish_reasons"])
    ).toEqual([["tool_calls"], ["stop"]]);

    const [tool] = spansNamed("execute_tool");
    expect(tool?.parentSpanContext?.spanId).toBe(turn?.spanContext().spanId);
    expect(tool?.attributes).toMatchObject({
      "gen_ai.tool.name": "search",
      "gen_ai.tool.call.id": "call-1",
    });
  });

  it("exports no prompt, reply or tool arguments", async () => {
    const fixture = build([
      toolCall("search", { q: "secret-query" }, "call-1"),
      { text: "secret-reply" },
    ]);

    await fixture.run({
      message: { text: "secret-prompt" },
      systemPrompt: "secret-system",
    });

    const exported = JSON.stringify(
      exporter
        .getFinishedSpans()
        .map((span) => [span.attributes, span.events, span.status])
    );
    for (const secret of [
      "secret-query",
      "secret-reply",
      "secret-prompt",
      "secret-system",
    ]) {
      expect(exported).not.toContain(secret);
    }
  });

  it("marks a provider failure on the model and turn spans", async () => {
    const fixture = build([{ error: "503 overloaded" }]);

    const result = await fixture.run();

    expect(result.status).toBe("error");
    const [chat] = spansNamed("chat ");
    expect(chat?.status.code).toBe(SpanStatusCode.ERROR);

    const [turn] = spansNamed("invoke_agent");
    expect(turn?.status.code).toBe(SpanStatusCode.ERROR);
    expect(turn?.attributes["error.type"]).toBe(
      result.status === "error" ? result.error.kind : undefined
    );
  });

  it("marks a thrown tool's span failed", async () => {
    const fixture = build([
      toolCall("leak", {}, "call-1"),
      { text: "Failed." },
    ]);

    await fixture.run({ tools: [leak] });

    const [tool] = spansNamed("execute_tool");
    expect(tool?.status.code).toBe(SpanStatusCode.ERROR);
  });

  /** A provider or tool message can carry the operator's content, so it stays in the log. */
  it("keeps a provider's failure text out of exported spans", async () => {
    const fixture = build([{ error: "503 overloaded: draft my private note" }]);

    await fixture.run();

    for (const span of exporter.getFinishedSpans()) {
      expect(exportedOf(span)).not.toContain("private note");
    }
  });

  it("records a thrown tool's class but not its message", async () => {
    const fixture = build([
      toolCall("leak", {}, "call-1"),
      { text: "Failed." },
    ]);

    await fixture.run({ tools: [leak] });

    const [tool] = spansNamed("execute_tool");
    expect(exportedOf(tool)).not.toContain("private note");
    expect(tool?.attributes["error.type"]).toBe("TypeError");
  });

  it("counts cache reads and writes in the input token total", async () => {
    const script = scriptedAdapter([
      {
        text: "Cached.",
        usage: {
          promptTokens: 3 + 5758 + 6174,
          completionTokens: 5,
          totalTokens: 3 + 5758 + 6174 + 5,
          promptTokensDetails: { cachedTokens: 5758, cacheWriteTokens: 6174 },
        },
      },
    ]);

    await complete({
      binding: bindingOf(script),
      systemPrompt: "Answer.",
      prompt: "Hi",
    });

    const [chat] = spansNamed("chat ");
    expect(chat?.attributes).toMatchObject({
      "gen_ai.usage.input_tokens": 3 + 5758 + 6174,
      "gen_ai.usage.cache_read.input_tokens": 5758,
      "gen_ai.usage.cache_creation.input_tokens": 6174,
    });
  });

  /**
   * An adapter whose prompt count leaves the cache out (native Anthropic) must still export the
   * whole prompt as input, as every other binding does.
   */
  it("counts cache reads and writes in the input token total when the adapter leaves them out", async () => {
    const script = scriptedAdapter([
      {
        text: "Cached.",
        usage: {
          promptTokens: 3,
          completionTokens: 5,
          totalTokens: 8,
          promptTokensDetails: { cachedTokens: 5758, cacheWriteTokens: 6174 },
        },
      },
    ]);

    await complete({
      binding: {
        ...bindingOf(script),
        api: "anthropic:messages",
        promptTokensIncludeCache: false,
      },
      systemPrompt: "Answer.",
      prompt: "Hi",
    });

    const [chat] = spansNamed("chat ");
    expect(chat?.attributes["gen_ai.usage.input_tokens"]).toBe(3 + 5758 + 6174);
  });
});
