import type { Locale } from "@chia/db/types";

import { TOOL_NAMES, labelOf } from "./registry.ts";
import {
  LocaleSchema,
  Type,
  defineTool,
  jsonBlock,
  textResult,
} from "./schema.ts";

/**
 * `validate_draft` — the reason an agent beats one-shot generation.
 *
 * The body is compiled through the *same* MDX pipeline the site renders with, so anything that
 * passes here cannot break the published page. The model gets the compiler error back and fixes
 * it itself; without this it would confidently emit MDX with an unclosed JSX tag and nobody
 * would find out until publish.
 *
 * The lint checks alongside it are cheap and catch the things a compiler cannot: heading
 * hierarchy, missing metadata, over-long SEO fields.
 */

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  severity: ValidationSeverity;
  rule: string;
  message: string;
  line?: number;
}

const MAX_DESCRIPTION_CHARS = 160;

export const validateDraftTool = defineTool({
  name: TOOL_NAMES.validateDraft,
  label: labelOf(TOOL_NAMES.validateDraft),
  description:
    "Compile a locale's draft body with the site's real MDX pipeline and lint its metadata. " +
    "Run this after every content change. If it reports errors, fix them and run it again — " +
    "never commit a draft that does not pass.",
  parameters: Type.Object({
    locale: LocaleSchema("Locale to validate."),
  }),
  executionMode: "sequential",
  async execute(_toolCallId, params, _signal, _onUpdate, context) {
    const locale = params.locale as Locale;
    const draft = await context.draft.get(context.agentSessionId);
    const translation = draft.translations[locale];

    if (!translation) {
      throw new Error(`No draft for locale "${locale}". Nothing to validate.`);
    }

    const body = translation.content ?? "";
    const issues: ValidationIssue[] = [];

    // --- MDX compilation (the authoritative check) ---
    if (body.trim().length === 0) {
      issues.push({
        severity: "error",
        rule: "content/empty",
        message: "The draft body is empty.",
      });
    } else {
      const compiled = await context.content.compileMdx(body);
      if (!compiled.ok) {
        issues.push({
          severity: "error",
          rule: "mdx/compile",
          message: compiled.message,
          line: compiled.line,
        });
      }
    }

    issues.push(...lintMetadata(translation, draft.feedMeta.slug));
    if (body.trim().length > 0) issues.push(...lintBody(body));

    const errors = issues.filter((issue) => issue.severity === "error");
    const warnings = issues.filter((issue) => issue.severity === "warning");

    if (errors.length === 0 && warnings.length === 0) {
      return textResult(
        `The ${locale} draft compiles and passes every check.`,
        { locale, ok: true, issues: [] }
      );
    }

    const summary = `The ${locale} draft has ${errors.length} error(s) and ${warnings.length} warning(s).`;
    const guidance =
      errors.length > 0
        ? "\n\nFix the errors and run validate_draft again before committing."
        : "\n\nWarnings do not block a commit, but address them if you can.";

    return textResult(`${summary}\n\n${jsonBlock(issues)}${guidance}`, {
      locale,
      ok: errors.length === 0,
      issues,
    });
  },
});

// ============================================
// Lint rules
// ============================================

const lintMetadata = (
  translation: {
    title?: string;
    excerpt?: string | null;
    description?: string | null;
  },
  slug: string | undefined
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];

  if (!translation.title || translation.title.trim().length === 0) {
    issues.push({
      severity: "error",
      rule: "meta/title-required",
      message:
        "`title` is required — the create/update procedure rejects a translation without one.",
    });
  }

  if (!slug) {
    issues.push({
      severity: "warning",
      rule: "meta/slug-missing",
      message:
        "No slug set. One will be generated from the title with a random suffix on commit; set it explicitly for a clean URL.",
    });
  }

  if (!translation.description) {
    issues.push({
      severity: "warning",
      rule: "meta/description-missing",
      message:
        "No SEO description. Search results will fall back to the excerpt.",
    });
  } else if (translation.description.length > MAX_DESCRIPTION_CHARS) {
    issues.push({
      severity: "warning",
      rule: "meta/description-too-long",
      message: `description is ${translation.description.length} characters; it is truncated at ${MAX_DESCRIPTION_CHARS}.`,
    });
  }

  if (!translation.excerpt) {
    issues.push({
      severity: "warning",
      rule: "meta/excerpt-missing",
      message: "No excerpt. Post listings will show nothing under the title.",
    });
  }

  return issues;
};

/**
 * Body checks the MDX compiler cannot make.
 *
 * Code fences are stripped first — a `#` inside a shell snippet is a comment, not a heading,
 * and a `[link](...)` inside a code block is documentation, not a link.
 */
const lintBody = (body: string): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const lines = stripFencedBlocks(body);

  // --- Heading hierarchy ---
  let previousDepth = 0;
  let sawH1 = false;

  lines.forEach((line, index) => {
    if (line === null) return;
    const match = /^(#{1,6})\s+\S/.exec(line);
    if (!match) return;
    const depth = match[1]!.length;

    if (depth === 1) {
      sawH1 = true;
      issues.push({
        severity: "warning",
        rule: "body/h1-in-content",
        message:
          "The page renders the post title as the H1 already; start body headings at H2.",
        line: index + 1,
      });
    }

    if (previousDepth > 0 && depth > previousDepth + 1) {
      issues.push({
        severity: "warning",
        rule: "body/heading-skip",
        message: `Heading jumps from H${previousDepth} to H${depth}, which breaks the table of contents.`,
        line: index + 1,
      });
    }
    previousDepth = depth;
  });

  void sawH1;

  // --- Links ---
  lines.forEach((line, index) => {
    if (line === null) return;
    for (const match of line.matchAll(/\[[^\]]*\]\(([^)\s]+)/g)) {
      const href = match[1]!;
      if (href.startsWith("./") || href.startsWith("../")) {
        issues.push({
          severity: "error",
          rule: "body/relative-link",
          message: `Relative link "${href}" will not resolve. Use a site-absolute path (/feed/slug) or a full URL.`,
          line: index + 1,
        });
      }
    }
  });

  // --- Unbalanced fences ---
  const fenceCount = (body.match(/^```/gm) ?? []).length;
  if (fenceCount % 2 !== 0) {
    issues.push({
      severity: "error",
      rule: "body/unbalanced-fence",
      message:
        "Odd number of ``` fences — a code block is left open, which swallows the rest of the post.",
    });
  }

  return issues;
};

/**
 * Returns one entry per source line, with lines inside fenced code blocks replaced by `null`,
 * so reported line numbers still match the real body.
 */
const stripFencedBlocks = (body: string): (string | null)[] => {
  let inFence = false;
  return body.split("\n").map((line) => {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      return null;
    }
    return inFence ? null : line;
  });
};
