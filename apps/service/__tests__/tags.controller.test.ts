import { beforeEach, describe, expect, it, vi } from "vitest";

import { CallerTier } from "@chia/auth/tier";
import type { DB } from "@chia/db/client";
import type * as TagsRepo from "@chia/db/repos/tags";

import * as guardMocks from "./helpers/guards";
import { client } from "./helpers/rpc";

const tags = vi.hoisted(() => ({
  listTags: vi.fn(
    async (
      _db: DB,
      _scope?: TagsRepo.TagCountScope
    ): Promise<TagsRepo.TagRecord[]> => []
  ),
}));

vi.mock("@chia/db/repos/tags", async (importOriginal) => ({
  ...(await importOriginal<typeof TagsRepo>()),
  listTags: tags.listTags,
}));

/** A tag is shared by both faces of the site, so each face asks for its own count. */
describe("tags.list", () => {
  beforeEach(() => {
    guardMocks.resetAllGuardMocks();
    guardMocks.setCallerTier(CallerTier.Anonymous);
    tags.listTags.mockClear();
  });

  it("counts the published posts of the asked mode", async () => {
    await client.tags.list({ mode: "tech" });

    expect(tags.listTags).toHaveBeenCalledExactlyOnceWith(expect.anything(), {
      published: true,
      mode: "tech",
    });
  });

  it("counts every published post when no mode is asked", async () => {
    await client.tags.list();

    expect(tags.listTags).toHaveBeenCalledExactlyOnceWith(expect.anything(), {
      published: true,
      mode: undefined,
    });
  });
});
