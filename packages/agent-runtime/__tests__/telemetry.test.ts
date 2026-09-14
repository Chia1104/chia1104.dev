import { fauxAssistantMessage } from "@earendil-works/pi-ai/providers/faux";
import { context, SpanStatusCode, trace } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { withModelSpans } from "../src/telemetry.ts";
import { toolDefiner, Type } from "../src/tools.ts";

import { build, toolCallTurn } from "./runtime.fixture.ts";
import type { TestContext } from "./runtime.fixture.ts";

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

describe("agent turn telemetry", () => {
  it("nests model and tool spans under the turn", async () => {
    const fixture = build();
    fixture.faux.setResponses([
      toolCallTurn("search", { q: "hono" }, "call-1"),
      fauxAssistantMessage("Found it."),
    ]);

    const result = await fixture.run({
      agentRunId: "run-1",
      models: withModelSpans(fixture.options.models),
    });

    expect(result.status).toBe("done");
    const [turn] = spansNamed("invoke_agent");
    expect(turn?.attributes).toMatchObject({
      "gen_ai.operation.name": "invoke_agent",
      "gen_ai.conversation.id": "session-1",
      "agent.run_id": "run-1",
      "agent.turn.status": "done",
    });

    const chats = spansNamed("chat ");
    expect(chats).toHaveLength(2);
    for (const chat of chats) {
      expect(chat.parentSpanContext?.spanId).toBe(turn?.spanContext().spanId);
      expect(chat.attributes).toMatchObject({
        "gen_ai.operation.name": "chat",
        "gen_ai.request.model": "test-model",
      });
      expect(chat.attributes["gen_ai.usage.input_tokens"]).toEqual(
        expect.any(Number)
      );
    }
    expect(
      chats.map((chat) => chat.attributes["gen_ai.response.finish_reasons"])
    ).toEqual([["toolUse"], ["stop"]]);

    const [tool] = spansNamed("execute_tool");
    expect(tool?.parentSpanContext?.spanId).toBe(turn?.spanContext().spanId);
    expect(tool?.attributes).toMatchObject({
      "gen_ai.tool.name": "search",
      "gen_ai.tool.call.id": "call-1",
    });
  });

  it("marks a provider failure on the model and turn spans", async () => {
    const fixture = build();
    fixture.faux.setResponses([
      fauxAssistantMessage("", {
        stopReason: "error",
        errorMessage: "503 overloaded",
      }),
    ]);

    const result = await fixture.run({
      models: withModelSpans(fixture.options.models),
    });

    expect(result.status).toBe("error");
    const [chat] = spansNamed("chat ");
    expect(chat?.status.code).toBe(SpanStatusCode.ERROR);
    expect(JSON.stringify([chat?.attributes, chat?.events])).not.toContain(
      "overloaded"
    );

    const [turn] = spansNamed("invoke_agent");
    expect(turn?.status.code).toBe(SpanStatusCode.ERROR);
    expect(turn?.attributes["error.type"]).toBe(result.error?.kind);
  });

  it("records a thrown tool's class but not its message", async () => {
    const leak = toolDefiner<TestContext>()({
      name: "leak",
      label: "Leak",
      description: "Fails with the operator's text.",
      parameters: Type.Object({}),
      execute: () => Promise.reject(new TypeError("draft: my private note")),
    });
    const fixture = build();
    fixture.faux.setResponses([
      toolCallTurn("leak", {}, "call-1"),
      fauxAssistantMessage("It failed."),
    ]);

    await fixture.run({ tools: [leak] });

    const [tool] = spansNamed("execute_tool");
    expect(tool?.status.code).toBe(SpanStatusCode.ERROR);
    expect(tool?.attributes["error.type"]).toBe("TypeError");
    expect(tool?.events).toEqual([]);
    expect(JSON.stringify([tool?.attributes, tool?.events])).not.toContain(
      "private note"
    );
  });
});
