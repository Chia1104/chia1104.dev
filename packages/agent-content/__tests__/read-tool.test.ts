import { describe, expect, it, vi } from "vitest";

import { getPostTool } from "../src/tools/read.tool.ts";
import type { ContentReadPort } from "../src/types.ts";

const createContent = (): ContentReadPort => ({
  searchPosts: vi.fn(() => Promise.resolve([])),
  getPost: vi.fn(() => Promise.resolve(null)),
  listPosts: vi.fn(() => Promise.resolve([])),
  listTags: vi.fn(() => Promise.resolve([])),
});

describe("getPostTool", () => {
  it("requires only a slug in the model-facing schema", () => {
    expect(getPostTool.parameters).toMatchObject({
      properties: {
        slug: { minLength: 1 },
      },
      required: ["slug"],
    });
    expect(getPostTool.parameters.properties).not.toHaveProperty("feedId");
  });

  it("ignores an extra feedId and looks up the supplied slug", async () => {
    const content = createContent();
    const providerArguments = { slug: "correct-slug", feedId: 1 };

    await expect(
      getPostTool.execute("call-1", providerArguments, undefined, undefined, {
        content,
      })
    ).rejects.toThrow('No post found for slug "correct-slug".');
    expect(content.getPost).toHaveBeenCalledWith({
      slug: "correct-slug",
      locale: undefined,
    });
  });
});
