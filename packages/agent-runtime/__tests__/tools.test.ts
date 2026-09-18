import { Type } from "typebox";
import { describe, expect, it, vi } from "vitest";

import type { JsonValue } from "@chia/utils/json";

import { defineTool, optional, textResult } from "../src/tools.ts";

/**
 * A model that fills every field needs `null` on offer, or it invents a value; the tool must
 * then never see that `null`. A hand-written null union keeps its `null`: there it means
 * something.
 */

describe("optional", () => {
  it("offers null next to the schema and keeps the description where the model reads it", () => {
    const schema = Type.Object({
      id: optional(Type.Integer({ description: "An id.", minimum: 1 })),
      limit: optional(Type.Integer({ default: 5 })),
    });

    expect(JSON.parse(JSON.stringify(schema))).toEqual({
      type: "object",
      properties: {
        id: {
          anyOf: [
            { type: "integer", description: "An id.", minimum: 1 },
            { type: "null" },
          ],
          description: "An id.",
        },
        limit: {
          anyOf: [{ type: "integer", default: 5 }, { type: "null" }],
          default: 5,
        },
      },
    });
  });
});

describe("defineTool", () => {
  const execute = vi.fn(async (_id: string, params: JsonValue) =>
    textResult("ok", params)
  );
  const tool = defineTool(
    {
      name: "t",
      label: "t",
      description: "d",
      parameters: Type.Object({
        id: optional(Type.Integer()),
        clear: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        edits: optional(
          Type.Array(Type.Object({ all: optional(Type.Boolean()) }))
        ),
      }),
    },
    () => execute
  )(undefined);

  it("drops a null on an optional parameter and keeps one on a hand-written null union", async () => {
    await tool.execute("call-1", { id: null, clear: null });
    expect(execute).toHaveBeenCalledWith(
      "call-1",
      { clear: null },
      undefined,
      undefined
    );
  });

  it("leaves a present value alone and walks into nested items", async () => {
    await tool.execute("call-2", {
      id: 3,
      edits: [{ all: null }, { all: true }],
    });
    expect(execute).toHaveBeenLastCalledWith(
      "call-2",
      { id: 3, edits: [{}, { all: true }] },
      undefined,
      undefined
    );
  });
});
