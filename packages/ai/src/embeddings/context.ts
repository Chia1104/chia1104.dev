import GithubSlugger from "github-slugger";

import {
  buildHeadingOutline,
  extractHeadings,
  splitByHeadings,
} from "./markdown.ts";
import { tryLoadTokenizer } from "./tokenizer.ts";
import { estimateEmbeddingTokens } from "./utils.ts";

/**
 * Decides how much of each retrieved document reaches the model.
 *
 * Budget is per request, not per document. Character truncation cannot
 * express that: 24k characters is ~6k tokens of English but ~16k of Chinese.
 *
 * Losing chunk rows also loses their `heading_path`, so anchors are
 * recomputed here at read time.
 */

/** Shared across all documents in one request. */
export const DEFAULT_CONTEXT_TOKEN_BUDGET = 24_000;

/** Cap so one document cannot starve the rest. */
const MAX_SHARE_PER_DOCUMENT = 0.6;

export type ContextDetail = "full" | "sections" | "outline";

export interface DocumentContextInput {
  slug: string;
  locale: string;
  title: string;
  summary?: string | null;
  content: string;
  /**
   * Retriever matches, most relevant first. Picks which sections survive
   * when the whole document does not fit.
   */
  matchedHeadingPaths?: (string | null)[];
}

export interface HeadingAnchor {
  /** `"HNSW > ef_search"` */
  path: string;
  title: string;
  /** `#hnsw-ef_search` fragment for deep links */
  anchor: string;
}

export interface DocumentContext {
  slug: string;
  locale: string;
  title: string;
  detail: ContextDetail;
  text: string;
  tokenCount: number;
  /** Anchors for headings kept in `text`, for citations */
  anchors: HeadingAnchor[];
}

export interface BuildContextResult {
  documents: DocumentContext[];
  totalTokens: number;
  budget: number;
  droppedSlugs: string[];
}

/**
 * Anchors matching the ids the site generates.
 *
 * Slug the whole document, then narrow: `GithubSlugger` disambiguates
 * repeated titles with `-1`, so slugging a subset would emit `#setup` for a
 * heading the page renders as `#setup-1`. Fresh instance per document; the
 * rendered page starts from scratch too.
 */
export const buildHeadingAnchors = async (
  content: string,
  keepPaths?: ReadonlySet<string>
): Promise<HeadingAnchor[]> => {
  const slugger = new GithubSlugger();
  const anchors = (await extractHeadings(content)).map((heading) => ({
    path: heading.path,
    title: heading.title,
    anchor: `#${slugger.slug(heading.title)}`,
  }));
  return keepPaths
    ? anchors.filter((entry) => keepPaths.has(entry.path))
    : anchors;
};

const countTokens = (
  text: string,
  encoding: Awaited<ReturnType<typeof tryLoadTokenizer>>
): number =>
  encoding ? encoding.encode(text).length : estimateEmbeddingTokens(text);

const truncateTokens = (
  text: string,
  maxTokens: number,
  encoding: Awaited<ReturnType<typeof tryLoadTokenizer>>
): string => {
  if (!encoding) {
    return text.slice(0, maxTokens * 2);
  }
  const encoded = encoding.encode(text);
  if (encoded.length <= maxTokens) {
    return text;
  }
  return encoding.decode(encoded.slice(0, maxTokens));
};

/**
 * Matched sections first, then the rest, so degrading keeps what the query
 * hit.
 */
const buildSectionsView = async (
  input: DocumentContextInput,
  maxTokens: number,
  encoding: Awaited<ReturnType<typeof tryLoadTokenizer>>
): Promise<{ text: string; keptPaths: Set<string> }> => {
  const sections = await splitByHeadings(input.content);
  const matched = new Set(
    (input.matchedHeadingPaths ?? []).filter((path): path is string => !!path)
  );

  const ordered = [
    ...sections.filter(
      (section) => section.headingPath && matched.has(section.headingPath)
    ),
    ...sections.filter(
      (section) => !section.headingPath || !matched.has(section.headingPath)
    ),
  ];

  const parts: string[] = [];
  const keptPaths = new Set<string>();
  let used = 0;
  for (const section of ordered) {
    // Leaf title, not the path: this heading is re-slugged downstream and
    // `## HNSW > ef_search` would anchor to `#hnsw--ef_search`
    const title = section.headingPath?.split(" > ").at(-1);
    const block = `${title ? `## ${title}\n` : ""}${section.text}`;
    const cost = countTokens(block, encoding);
    if (used + cost > maxTokens) {
      continue;
    }
    parts.push(block);
    if (section.headingPath) {
      keptPaths.add(section.headingPath);
    }
    used += cost;
  }

  return { text: parts.join("\n\n"), keptPaths };
};

/** Summary plus heading outline; cheapest view that still identifies the post. */
const buildOutlineView = async (input: DocumentContextInput): Promise<string> =>
  [
    input.summary?.trim() ? input.summary.trim() : null,
    await buildHeadingOutline(input.content),
  ]
    .filter((part): part is string => !!part)
    .join("\n\n");

/**
 * Fits documents into a shared token budget, degrading in place:
 * full → matched sections → summary + outline.
 *
 * Processed in the given (retrieval) order, so the least relevant documents
 * lose detail first.
 */
export const buildDocumentContext = async (
  inputs: DocumentContextInput[],
  options: { budget?: number } = {}
): Promise<BuildContextResult> => {
  const budget = options.budget ?? DEFAULT_CONTEXT_TOKEN_BUDGET;
  const encoding = await tryLoadTokenizer();

  const documents: DocumentContext[] = [];
  const droppedSlugs: string[] = [];
  let totalTokens = 0;

  for (const input of inputs) {
    const remaining = budget - totalTokens;
    if (remaining <= 0) {
      droppedSlugs.push(input.slug);
      continue;
    }
    // No single document may starve the ones after it
    const allowance = Math.min(
      remaining,
      Math.max(1, Math.floor(budget * MAX_SHARE_PER_DOCUMENT))
    );

    const sections = await buildSectionsView(input, allowance, encoding);
    const outlineView = await buildOutlineView(input);
    // Anchors come from the untouched document so slugs match the rendered
    // page; `keepPaths` narrows them to what the view contains
    const candidates: {
      detail: ContextDetail;
      text: string;
      keepPaths?: ReadonlySet<string>;
    }[] = [
      { detail: "full", text: input.content },
      {
        detail: "sections",
        text: sections.text,
        keepPaths: sections.keptPaths,
      },
      { detail: "outline", text: outlineView },
    ];

    let chosen: DocumentContext | null = null;
    for (const candidate of candidates) {
      if (!candidate.text.trim()) {
        continue;
      }
      const cost = countTokens(candidate.text, encoding);
      if (cost <= allowance) {
        chosen = {
          slug: input.slug,
          locale: input.locale,
          title: input.title,
          detail: candidate.detail,
          text: candidate.text,
          tokenCount: cost,
          anchors: await buildHeadingAnchors(
            input.content,
            candidate.keepPaths
          ),
        };
        break;
      }
    }

    // Outline still over budget: hard-truncate rather than drop the document
    if (!chosen) {
      const text = truncateTokens(
        outlineView || input.title,
        allowance,
        encoding
      );
      chosen = {
        slug: input.slug,
        locale: input.locale,
        title: input.title,
        detail: "outline",
        text,
        tokenCount: countTokens(text, encoding),
        anchors: [],
      };
    }

    documents.push(chosen);
    totalTokens += chosen.tokenCount;
  }

  return { documents, totalTokens, budget, droppedSlugs };
};
