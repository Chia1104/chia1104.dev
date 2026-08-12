import GithubSlugger from "github-slugger";

import {
  buildHeadingOutline,
  extractHeadings,
  splitByHeadings,
} from "./markdown.ts";
import { tryLoadTokenizer } from "./tokenizer.ts";
import { estimateEmbeddingTokens } from "./utils.ts";

/**
 * Chunkless context assembly: retrieval returns *documents*, and this decides
 * how much of each document actually reaches the model.
 *
 * The budget is per request, not per document. Character-based truncation
 * cannot express that — 24k characters is ~6k tokens of English but ~16k of
 * Chinese, so the same limit means wildly different things depending on the
 * post, and N posts each "within the limit" can still blow the window.
 *
 * Losing chunk rows also means losing their `heading_path`, which is what
 * citations anchor to. Anchors are recomputed here at read time instead.
 */

/** Total tokens all documents in one request may occupy. */
export const DEFAULT_CONTEXT_TOKEN_BUDGET = 24_000;

/** A single document may not take more than this share of the budget. */
const MAX_SHARE_PER_DOCUMENT = 0.6;

export type ContextDetail = "full" | "sections" | "outline";

export interface DocumentContextInput {
  slug: string;
  locale: string;
  title: string;
  summary?: string | null;
  content: string;
  /**
   * Heading paths the retriever matched, most relevant first. Used to pick
   * which sections survive when the whole document does not fit.
   */
  matchedHeadingPaths?: (string | null)[];
}

export interface HeadingAnchor {
  /** `"HNSW > ef_search"` */
  path: string;
  title: string;
  /** `#hnsw-ef_search`-style fragment for deep links */
  anchor: string;
}

export interface DocumentContext {
  slug: string;
  locale: string;
  title: string;
  /** how much of the document survived the budget */
  detail: ContextDetail;
  text: string;
  tokenCount: number;
  /** anchors for every heading kept in `text`, for citations */
  anchors: HeadingAnchor[];
}

export interface BuildContextResult {
  documents: DocumentContext[];
  totalTokens: number;
  budget: number;
  /** documents dropped entirely because the budget ran out */
  droppedSlugs: string[];
}

/**
 * Anchors for a document's headings, matching the ids the site generates.
 *
 * Always slug the *whole* document, then narrow: `GithubSlugger` disambiguates
 * repeated titles with `-1`, so slugging a subset of the headings would emit
 * `#setup` for one the page renders as `#setup-1`. A fresh instance per
 * document, since the rendered page starts from scratch too.
 */
export const buildHeadingAnchors = (
  content: string,
  keepPaths?: ReadonlySet<string>
): HeadingAnchor[] => {
  const slugger = new GithubSlugger();
  const anchors = extractHeadings(content).map((heading) => ({
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
 * Sections whose heading path was matched by the retriever, in match order,
 * then the rest — so degrading keeps the parts the query actually hit.
 */
const buildSectionsView = (
  input: DocumentContextInput,
  maxTokens: number,
  encoding: Awaited<ReturnType<typeof tryLoadTokenizer>>
): { text: string; keptPaths: Set<string> } => {
  const sections = splitByHeadings(input.content);
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
    // the leaf title, not the path: this heading is re-slugged downstream and
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

/** Cheapest representation: what the post is about and how it is organised. */
const buildOutlineView = (input: DocumentContextInput): string =>
  [
    input.summary?.trim() ? input.summary.trim() : null,
    buildHeadingOutline(input.content),
  ]
    .filter((part): part is string => !!part)
    .join("\n\n");

/**
 * Fits documents into a shared token budget, degrading each one in place
 * rather than cutting it off mid-sentence:
 *
 *   full → matched sections (+ as much of the rest as fits) → summary + outline
 *
 * Documents are processed in the order given (i.e. retrieval order), so when
 * the budget runs out it is the least relevant documents that lose detail.
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
    // no single document may starve the ones after it
    const allowance = Math.min(
      remaining,
      Math.max(1, Math.floor(budget * MAX_SHARE_PER_DOCUMENT))
    );

    const sections = buildSectionsView(input, allowance, encoding);
    // anchors always come from the untouched document, so their slugs match the
    // rendered page whichever view survives; `keepPaths` narrows them to what
    // the view actually contains
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
      { detail: "outline", text: buildOutlineView(input) },
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
          anchors: buildHeadingAnchors(input.content, candidate.keepPaths),
        };
        break;
      }
    }

    // even the outline does not fit — hard-truncate it rather than drop the
    // document, so the model at least knows the post exists
    if (!chosen) {
      const text = truncateTokens(
        buildOutlineView(input) || input.title,
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
