import { convertSchemaToJsonSchema } from "@tanstack/ai";
import { describe, expect, it, vi } from "vitest";
import * as z from "zod";

import { defineTool, jsonBlock, truncate } from "../src/tools.ts";
import type { ToolCall } from "../src/tools.ts";

describe("optional parameters", () => {
  it("are offered as not required, with the description on the property the model reads", () => {
    const schema = z.object({
      id: z.number().int().min(1).describe("An id.").optional(),
      name: z.string(),
    });

    // What the engine converts the schema to; strict adapters widen `id` to nullable from here.
    expect(convertSchemaToJsonSchema(schema)).toMatchObject({
      type: "object",
      properties: {
        id: { type: "integer", minimum: 1, description: "An id." },
        name: { type: "string" },
      },
      required: ["name"],
    });
  });
});

describe("defineTool", () => {
  const parameters = z.object({ id: z.number().int().optional() });
  const run = vi.fn((params: z.output<typeof parameters>, _call: ToolCall) =>
    Promise.resolve({ text: "ok", details: params })
  );
  const factory = defineTool(
    { name: "t", description: "d", parameters },
    () => run
  );

  it("hands execute the arguments the engine validated", async () => {
    await factory(undefined).execute({ id: 3 }, { toolCallId: "call-1" });
    expect(run).toHaveBeenLastCalledWith({ id: 3 }, { toolCallId: "call-1" });
  });

  it("exposes its spec without binding a turn", () => {
    expect(factory.spec).toMatchObject({ name: "t", description: "d" });
    expect(factory(undefined)).toMatchObject({ name: "t", description: "d" });
  });
});

describe("truncate", () => {
  it("marks a cut so the model knows it saw a prefix", () => {
    expect(truncate("abcdef", 10)).toEqual({
      text: "abcdef",
      truncated: false,
    });
    expect(truncate("abcdef", 4)).toEqual({
      text: "abcd\n\n… [truncated 2 more characters]",
      truncated: true,
    });
  });
});

describe("jsonBlock", () => {
  it("fences the value as JSON", () => {
    expect(jsonBlock({ a: 1 })).toBe('```json\n{\n  "a": 1\n}\n```');
  });
});
