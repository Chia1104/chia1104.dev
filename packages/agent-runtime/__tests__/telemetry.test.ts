import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import { fauxAssistantMessage } from "@earendil-works/pi-ai/providers/faux";
import { context, SpanStatusCode, trace } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { Type } from "typebox";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { traceModelStream, withModelSpans } from "../src/telemetry.ts";
import { defineTool } from "../src/tools.ts";

import { build, toolCallTurn } from "./runtime.fixture.ts";

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
    expect(turn?.attributes["error.type"]).toBe(
      result.status === "error" ? result.error.kind : undefined
    );
  });

  it("records a thrown tool's class but not its message", async () => {
    const leak = defineTool(
      {
        name: "leak",
        label: "Leak",
        description: "Fails with the operator's text.",
        parameters: Type.Object({}),
      },
      () => () => Promise.reject(new TypeError("draft: my private note"))
    )({});
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

  it("counts cache reads and writes in the input token total", async () => {
    const fixture = build();
    const reply = fauxAssistantMessage("Cached.");
    reply.usage = {
      ...reply.usage,
      input: 3,
      cacheRead: 5758,
      cacheWrite: 6174,
    };

    const stream = traceModelStream(fixture.faux.getModel(), () => {
      const source = createAssistantMessageEventStream();
      source.push({ type: "done", reason: "stop", message: reply });
      return source;
    });
    await stream.result();
    // The span ends after the stream hands its result on.
    await vi.waitFor(() => expect(spansNamed("chat ")).toHaveLength(1));

    const [chat] = spansNamed("chat ");
    expect(chat?.attributes).toMatchObject({
      "gen_ai.usage.input_tokens": 3 + 5758 + 6174,
      "gen_ai.usage.cache_read.input_tokens": 5758,
      "gen_ai.usage.cache_creation.input_tokens": 6174,
    });
  });
});
