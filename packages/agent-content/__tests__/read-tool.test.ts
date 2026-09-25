import { describe, expect, it, vi } from "vitest";
import * as z from "zod";

import { getPostSpec, getPostTool } from "../src/tools/read.tool.ts";
import type { ContentReadPort } from "../src/types.ts";

const createContent = (): ContentReadPort => ({
  searchPosts: vi.fn(() => Promise.resolve({ hits: [], answerable: null })),
  getPost: vi.fn(() => Promise.resolve(null)),
  listPosts: vi.fn(() => Promise.resolve({ posts: [], total: 0 })),
  listTags: vi.fn(() => Promise.resolve([])),
});

describe("getPostTool", () => {
  it("requires only a slug in the model-facing schema", () => {
    // The schema the model is offered is the input side: what it may send.
    const schema = z.toJSONSchema(getPostSpec.parameters, { io: "input" });

    expect(schema).toMatchObject({
      properties: {
        slug: { minLength: 1 },
      },
      required: ["slug"],
    });
    expect(schema.properties).not.toHaveProperty("feedId");
  });

  it("ignores an extra feedId and looks up the supplied slug", async () => {
    const content = createContent();
    const providerArguments = { slug: "correct-slug", feedId: 1 };

    await expect(
      getPostTool({
        content,
      }).execute(providerArguments, { toolCallId: "call-1" })
    ).rejects.toThrow('No post found for slug "correct-slug".');
    expect(content.getPost).toHaveBeenCalledWith({
      slug: "correct-slug",
      locale: undefined,
    });
  });
});
