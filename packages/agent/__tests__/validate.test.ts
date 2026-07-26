import { describe, expect, it } from "vitest";

import { InMemoryDraftStore } from "../src/draft/index.ts";
import { InMemoryPendingMessageStore } from "../src/session/pg-pending-messages.ts";
import { validateDraftTool } from "../src/tools/validate.tool.ts";
import type { ValidationIssue } from "../src/tools/validate.tool.ts";
import type { WritingToolContext } from "../src/types.ts";

import { createFakeContentPort } from "./fixtures.ts";

const SESSION_ID = "session-1";

interface RunOptions {
  meta?: { title?: string; excerpt?: string; description?: string };
  /** `null` means "leave the slug unset" — an explicit `undefined` would hit the default. */
  slug?: string | null;
}

const runValidate = async (body: string, options: RunOptions = {}) => {
  const meta = options.meta ?? {
    title: "A title",
    excerpt: "An excerpt",
    description: "A description",
  };
  const slug = options.slug === null ? undefined : (options.slug ?? "a-slug");

  const draft = new InMemoryDraftStore();
  if (slug !== undefined) await draft.patchFeedMeta(SESSION_ID, { slug });
  await draft.patchTranslation(SESSION_ID, "en", { ...meta, content: body });

  const context: WritingToolContext = {
    agentSessionId: SESSION_ID,
    adminId: "admin-1",
    content: createFakeContentPort(),
    draft,
    pending: new InMemoryPendingMessageStore(),
  };

  const result = await validateDraftTool.execute(
    "call-1",
    { locale: "en" },
    undefined,
    undefined,
    context
  );
  return result.details as { ok: boolean; issues: ValidationIssue[] };
};

const rulesOf = (issues: ValidationIssue[]) =>
  issues.map((issue) => issue.rule);

describe("validate_draft", () => {
  it("passes clean MDX with complete metadata", async () => {
    const result = await runValidate(
      "## Section\n\nSome prose.\n\n```ts\nconst x = 1;\n```"
    );
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("reports an unclosed JSX tag as a compile error", async () => {
    const result = await runValidate("## Section\n\n<Callout>never closed");
    expect(result.ok).toBe(false);
    expect(rulesOf(result.issues)).toContain("mdx/compile");
  });

  it("catches an unbalanced code fence, which would swallow the rest of the post", async () => {
    const result = await runValidate("## Section\n\n```ts\nconst x = 1;");
    expect(result.ok).toBe(false);
    expect(rulesOf(result.issues)).toContain("body/unbalanced-fence");
  });

  it("rejects relative links, which do not resolve on the site", async () => {
    const result = await runValidate(
      "## Section\n\nSee [the other post](../other-post)."
    );
    expect(result.ok).toBe(false);
    const issue = result.issues.find(
      (candidate) => candidate.rule === "body/relative-link"
    );
    expect(issue?.line).toBe(3);
  });

  it("ignores markup inside code fences", async () => {
    // A `#` here is a shell comment and `[x](./y)` is documentation, not a heading or a link.
    const result = await runValidate(
      "## Section\n\n```sh\n# a comment\n[label](./relative)\n```"
    );
    expect(rulesOf(result.issues)).not.toContain("body/relative-link");
    expect(rulesOf(result.issues)).not.toContain("body/h1-in-content");
    expect(result.ok).toBe(true);
  });

  it("warns about an H1 in the body and a skipped heading level", async () => {
    const result = await runValidate("# Title\n\n## Section\n\n#### Too deep");
    const rules = rulesOf(result.issues);
    expect(rules).toContain("body/h1-in-content");
    expect(rules).toContain("body/heading-skip");
    // Both are warnings — they do not block a commit.
    expect(result.ok).toBe(true);
  });

  it("errors when the title is missing, since the API rejects it", async () => {
    const result = await runValidate("## Section\n\nBody.", {
      meta: { excerpt: "An excerpt" },
    });
    expect(result.ok).toBe(false);
    expect(rulesOf(result.issues)).toContain("meta/title-required");
  });

  it("warns on a missing slug and an over-long description", async () => {
    const result = await runValidate("## Section\n\nBody.", {
      meta: { title: "A title", description: "x".repeat(200) },
      slug: null,
    });
    const rules = rulesOf(result.issues);
    expect(rules).toContain("meta/slug-missing");
    expect(rules).toContain("meta/description-too-long");
    expect(result.ok).toBe(true);
  });

  it("errors on an empty body", async () => {
    const result = await runValidate("   ");
    expect(result.ok).toBe(false);
    expect(rulesOf(result.issues)).toContain("content/empty");
  });
});
