import { describe, expect, it } from "vitest";

import { parseGitHubRepos, writingConfigSchema } from "../src/config.ts";

describe("githubRepos config", () => {
  it("parses newline and comma separated entries, lower-cased and de-duplicated", () => {
    expect(
      parseGitHubRepos(
        "Chia1104/chia1104.dev\n chia1104/notes, chia1104/Notes\n\n"
      )
    ).toEqual(["chia1104/chia1104.dev", "chia1104/notes"]);
    expect(parseGitHubRepos(undefined)).toEqual([]);
  });

  it("rejects an entry that is not owner/name at the schema, so the dashboard cannot save it", () => {
    expect(
      writingConfigSchema.safeParse({ githubRepos: "chia1104/chia1104.dev" })
        .success
    ).toBe(true);
    const bad = writingConfigSchema.safeParse({
      githubRepos: "https://github.com/chia1104/chia1104.dev",
    });
    expect(bad.success).toBe(false);
    expect(
      writingConfigSchema.safeParse({ githubRepos: "chia1104" }).success
    ).toBe(false);
  });
});
