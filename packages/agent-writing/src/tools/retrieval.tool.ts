import { contentReadTools } from "@chia/agent-content/tools/read";

import type { WritingTool } from "../types.ts";

import { TOOL_NAMES, labelOf } from "./registry.ts";
import { Type, defineTool, textResult, truncate } from "./schema.ts";

/**
 * Tier 1 — read-only grounding tools: the shared content read tools plus `fetch_url`, which only
 * the writing agent gets. Outbound fetches are a cost and an SSRF surface, acceptable for the
 * operator's own authoring session and not for a public one.
 */

const MAX_PAGE_CHARS = 16_000;

export const fetchUrlTool = defineTool({
  name: TOOL_NAMES.fetchUrl,
  label: labelOf(TOOL_NAMES.fetchUrl),
  description:
    "Fetch a public web page and return its readable text. Use it to check a fact or read a " +
    "reference the operator linked. Returns plain text only — no scripts, no images.",
  parameters: Type.Object({
    url: Type.String({
      description: "Absolute http(s) URL.",
      format: "uri",
    }),
  }),
  executionMode: "parallel",
  async execute(_toolCallId, params, _signal, _onUpdate, context) {
    let parsed: URL;
    try {
      parsed = new URL(params.url);
    } catch {
      throw new Error(`"${params.url}" is not a valid absolute URL.`);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Only http and https URLs can be fetched.");
    }

    const page = await context.content.fetchPage(parsed.toString());
    const body = truncate(page.text, MAX_PAGE_CHARS);

    return textResult(
      `# ${page.title ?? parsed.hostname}\n<${page.url}>\n\n${body.text}`,
      { url: page.url, title: page.title, truncated: body.truncated }
    );
  },
});

/**
 * The content tools are typed over the narrower `ContentToolContext`; a `WritingToolContext`
 * satisfies it, so they slot into the writing tool set unchanged.
 */
export const retrievalTools: WritingTool[] = [
  ...contentReadTools,
  fetchUrlTool,
];
