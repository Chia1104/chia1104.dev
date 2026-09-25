import { validateToolArguments } from "@earendil-works/pi-ai";
import { describe, expect, it, vi } from "vitest";
import * as z from "zod";

import { asJsonObject } from "@chia/utils/json";
import type { JsonObject } from "@chia/utils/json";

import { toPiTool } from "../src/pi/tools.ts";
import { defineTool } from "../src/tools.ts";
import type { AgentPolicy } from "../src/types.ts";

/**
 * A model that fills every field needs `null` on offer, or it invents a value; the tool must
 * then never see that `null`. A parameter that is itself nullable keeps its `null`: there it
 * means something.
 */

const policy: Pick<AgentPolicy, "toolInfo"> = {
  toolInfo: () => ({ label: "Tool", tier: "read" }),
};

const bind = (
  execute = vi.fn(async (params: JsonObject) => ({
    text: "ok",
    details: params,
  }))
) => {
  const tool = defineTool(
    {
      name: "t",
      description: "d",
      parameters: z.object({
        id: z.number().int().min(1).describe("An id.").optional(),
        clear: z.string().nullable().optional(),
        edits: z.array(z.object({ all: z.boolean().optional() })).optional(),
        name: z.string(),
      }),
    },
    () => execute
  )(undefined);
  return {
    piTool: toPiTool(tool, { policy, log: { sessionId: "s" } }),
    execute,
  };
};

/** What Pi does with the model's arguments before `execute`. */
const callPi = async (
  piTool: ReturnType<typeof bind>["piTool"],
  args: JsonObject
) => {
  const prepared = asJsonObject(piTool.prepareArguments?.(args) ?? args) ?? {};
  const validated = validateToolArguments(piTool, {
    type: "toolCall",
    id: "call-1",
    name: piTool.name,
    arguments: prepared,
  });
  return piTool.execute("call-1", validated);
};

describe("toPiTool", () => {
  it("offers null on optional parameters and keeps the description where the model reads it", () => {
    const { piTool } = bind();
    expect(JSON.parse(JSON.stringify(piTool.parameters))).toEqual({
      type: "object",
      properties: {
        id: {
          anyOf: [
            {
              type: "integer",
              minimum: 1,
              maximum: Number.MAX_SAFE_INTEGER,
            },
            { type: "null" },
          ],
          description: "An id.",
        },
        clear: { type: ["string", "null"] },
        edits: {
          anyOf: [
            {
              type: "array",
              items: {
                type: "object",
                properties: {
                  all: { anyOf: [{ type: "boolean" }, { type: "null" }] },
                },
              },
            },
            { type: "null" },
          ],
        },
        name: { type: "string" },
      },
      required: ["name"],
    });
    expect(piTool.label).toBe("Tool");
  });

  it("drops a null on an optional parameter and keeps one on a nullable parameter", async () => {
    const { piTool, execute } = bind();
    await callPi(piTool, { id: null, clear: null, name: "n" });
    expect(execute).toHaveBeenCalledWith(
      { clear: null, name: "n" },
      { toolCallId: "call-1", signal: undefined }
    );
  });

  it("walks into nested items and leaves present values alone", async () => {
    const { piTool, execute } = bind();
    await callPi(piTool, {
      id: 3,
      edits: [{ all: null }, { all: true }],
      name: "n",
    });
    expect(execute).toHaveBeenLastCalledWith(
      { id: 3, edits: [{}, { all: true }], name: "n" },
      { toolCallId: "call-1", signal: undefined }
    );
  });

  it("hands Pi the text for the model and the details for clients", async () => {
    const { piTool } = bind(
      vi.fn(async () => ({ text: "read 3", details: { count: 3 } }))
    );
    await expect(callPi(piTool, { name: "n" })).resolves.toEqual({
      content: [{ type: "text", text: "read 3" }],
      details: { count: 3 },
    });
  });

  it("throws what zod rejects beyond the JSON Schema", async () => {
    const piTool = toPiTool(
      defineTool(
        {
          name: "t",
          description: "d",
          parameters: z.object({
            slug: z.string().refine((value) => value === value.toLowerCase(), {
              message: "Lowercase only.",
            }),
          }),
        },
        () => async () => ({ text: "ok" })
      )(undefined),
      { policy, log: { sessionId: "s" } }
    );
    await expect(callPi(piTool, { slug: "ABC" })).rejects.toThrow(
      "Lowercase only."
    );
  });
});
