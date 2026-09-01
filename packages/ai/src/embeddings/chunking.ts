import type { Tiktoken } from "js-tiktoken";

import { cleanMdxKeepStructure, splitByHeadings } from "./markdown.ts";
import { countEmbeddingTokens, loadTokenizer } from "./tokenizer.ts";
import { truncateForEmbedding } from "./utils.ts";

export { countEmbeddingTokens, loadTokenizer };
export { cleanMdxKeepStructure, splitByHeadings } from "./markdown.ts";

/** Target size of a section chunk. */
export const SECTION_CHUNK_TOKENS = 512;

/** Chunks below this carry no signal. */
const MIN_CHUNK_TOKENS = 8;

export interface MarkdownChunk {
  /** 0-based within the document */
  chunkIndex: number;
  content: string;
  /** First heading covered by the chunk. */
  headingPath: string | null;
  /** Every heading covered, when a chunk packs more than one section. */
  headingPaths: string[];
  tokenCount: number;
}

interface SplitUnit {
  text: string;
  /** what to put back when this unit follows another in the same piece */
  joiner: string;
}

/**
 * Paragraph boundaries first, then sentence-ish punctuation.
 *
 * The joiner records which boundary a unit came from, so reassembling does not
 * turn every sentence of one paragraph into a paragraph of its own — the chunk
 * text is stored and rendered as snippets, not just embedded.
 */
const toUnits = (
  text: string,
  maxTokens: number,
  encoding: Tiktoken | null
): SplitUnit[] =>
  text.split(/\n{2,}/).flatMap((paragraph) => {
    if (countEmbeddingTokens(paragraph, encoding) <= maxTokens) {
      return [{ text: paragraph, joiner: "\n\n" }];
    }
    // the lookbehind keeps the delimiter on the preceding sentence, so joining
    // with "" restores the paragraph verbatim
    return paragraph.split(/(?<=[。．！？!?;；\n])/).map((sentence, index) => ({
      text: sentence,
      joiner: index === 0 ? "\n\n" : "",
    }));
  });

/**
 * Last resort for a unit with no boundary left to split on — a long CJK
 * paragraph without `。`, a wide table row. Slicing keeps the tail searchable;
 * emitting it whole would hand the provider an over-length input and store
 * text that does not match the vector.
 */
const sliceToBudget = (text: string, maxTokens: number): string[] => {
  const slices: string[] = [];
  let rest = text;
  while (rest) {
    const head = truncateForEmbedding(rest, maxTokens);
    // the estimate is pessimistic, never zero-length for a non-empty input, but
    // the fallback guarantees progress
    const take = head.length > 0 ? head : rest.slice(0, 1);
    slices.push(take);
    rest = rest.slice(take.length);
  }
  return slices;
};

const splitOversized = (
  text: string,
  maxTokens: number,
  encoding: Tiktoken | null
): string[] => {
  const pieces: string[] = [];
  let buffer = "";
  let bufferTokens = 0;

  const flush = () => {
    if (buffer.trim()) {
      pieces.push(buffer.trim());
    }
    buffer = "";
    bufferTokens = 0;
  };

  for (const unit of toUnits(text, maxTokens, encoding)) {
    const unitTokens = countEmbeddingTokens(unit.text, encoding);

    if (buffer && bufferTokens + unitTokens > maxTokens) {
      flush();
    }

    if (unitTokens > maxTokens) {
      flush();
      for (const slice of sliceToBudget(unit.text, maxTokens)) {
        if (slice.trim()) {
          pieces.push(slice.trim());
        }
      }
      continue;
    }

    buffer += (buffer ? unit.joiner : "") + unit.text;
    bufferTokens += unitTokens;
  }
  flush();

  return pieces;
};

/**
 * A section's heading path, baked into the chunk text as its first line.
 *
 * `splitByHeadings` strips heading lines, and the chunk `content` is what gets
 * embedded and BM25-indexed — without this, a query for the heading's words
 * ("CSRF", "hydrateRoot") cannot reach the section that answers it, because
 * headings are precisely the words a body rarely repeats. The full ancestor
 * path rather than the leaf, so "參數" arrives as "HNSW 調校 > 參數".
 */
const withHeadingPrefix = (
  headingMarkdownPath: string | null,
  text: string
): string => (headingMarkdownPath ? `${headingMarkdownPath}\n\n${text}` : text);

/**
 * Headings at or above this level start a new pack group.
 *
 * Packing may not cross group boundaries, because a greedy pack over the whole
 * document cascades: text inserted at the top changes which sections land in
 * every later chunk, so every hash changes and `planChunkReplacement` sees a
 * full rewrite instead of moves. A boundary at every H1/H2 bounds that cascade
 * to one group — and the rule reads only the heading's own level, so an edit
 * elsewhere in the document can never change where a group starts.
 */
const GROUP_BOUNDARY_LEVEL = 2;

/**
 * Splits a document into section chunks at heading boundaries, packing small
 * sections together (never across an H1/H2 boundary — see
 * `GROUP_BOUNDARY_LEVEL`) and splitting oversized ones.
 *
 * `headingPath` is carried through for citation anchors, and additionally
 * prefixed onto each section's text (see `withHeadingPrefix`).
 */
export const chunkMarkdown = async (params: {
  content: string;
  targetTokens?: number;
  encoding?: Tiktoken | null;
}): Promise<MarkdownChunk[]> => {
  const cleaned = await cleanMdxKeepStructure(params.content);
  if (!cleaned) {
    return [];
  }

  const encoding = params.encoding ?? (await loadTokenizer());
  const targetTokens = params.targetTokens ?? SECTION_CHUNK_TOKENS;

  const chunks: MarkdownChunk[] = [];
  let buffer: { headingPath: string | null; text: string }[] = [];
  let bufferTokens = 0;

  const flush = () => {
    if (buffer.length === 0) {
      return;
    }
    const content = buffer.map((entry) => entry.text).join("\n\n");
    const tokenCount = countEmbeddingTokens(content, encoding);
    if (tokenCount >= MIN_CHUNK_TOKENS) {
      const headingPaths = [
        ...new Set(
          buffer
            .map((entry) => entry.headingPath)
            .filter((path): path is string => !!path)
        ),
      ];
      chunks.push({
        chunkIndex: chunks.length,
        content,
        headingPath: headingPaths[0] ?? null,
        headingPaths,
        tokenCount,
      });
    }
    buffer = [];
    bufferTokens = 0;
  };

  for (const section of await splitByHeadings(cleaned)) {
    if (section.level !== null && section.level <= GROUP_BOUNDARY_LEVEL) {
      flush();
    }

    const text = withHeadingPrefix(section.headingMarkdownPath, section.text);
    const sectionTokens = countEmbeddingTokens(text, encoding);

    if (sectionTokens > targetTokens) {
      flush();
      // every piece repeats the prefix — each becomes its own chunk and must
      // carry the heading context itself — so the split budget pays for it
      const prefixTokens = section.headingMarkdownPath
        ? sectionTokens - countEmbeddingTokens(section.text, encoding)
        : 0;
      for (const piece of splitOversized(
        section.text,
        Math.max(targetTokens - prefixTokens, 1),
        encoding
      )) {
        buffer.push({
          headingPath: section.headingPath,
          text: withHeadingPrefix(section.headingMarkdownPath, piece),
        });
        flush();
      }
      continue;
    }

    if (bufferTokens + sectionTokens > targetTokens) {
      flush();
    }
    buffer.push({ headingPath: section.headingPath, text });
    bufferTokens += sectionTokens;
  }
  flush();

  return chunks;
};
