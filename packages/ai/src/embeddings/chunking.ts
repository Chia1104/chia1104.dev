import type { Tiktoken } from "js-tiktoken";

import { cleanMdxKeepStructure, splitByHeadings } from "./markdown.ts";
import { countEmbeddingTokens, loadTokenizer } from "./tokenizer.ts";

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

/** Paragraph boundaries first, then sentence-ish punctuation. */
const splitOversized = (
  text: string,
  maxTokens: number,
  encoding: Tiktoken | null
): string[] => {
  const units = text.split(/\n{2,}/).flatMap((paragraph) =>
    countEmbeddingTokens(paragraph, encoding) <= maxTokens
      ? [paragraph]
      : paragraph.split(/(?<=[。．！？!?;；\n])/)
  );

  const pieces: string[] = [];
  let buffer = "";
  let bufferTokens = 0;

  for (const unit of units) {
    const unitTokens = countEmbeddingTokens(unit, encoding);
    if (buffer && bufferTokens + unitTokens > maxTokens) {
      pieces.push(buffer.trim());
      buffer = "";
      bufferTokens = 0;
    }
    buffer += (buffer ? "\n\n" : "") + unit;
    bufferTokens += unitTokens;
  }
  if (buffer.trim()) {
    pieces.push(buffer.trim());
  }

  return pieces;
};

/**
 * Splits a document into section chunks at heading boundaries, packing small
 * sections together and splitting oversized ones.
 *
 * `headingPath` is carried through for citation anchors.
 */
export const chunkMarkdown = async (params: {
  content: string;
  targetTokens?: number;
  encoding?: Tiktoken | null;
}): Promise<MarkdownChunk[]> => {
  const cleaned = cleanMdxKeepStructure(params.content);
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

  for (const section of splitByHeadings(cleaned)) {
    const sectionTokens = countEmbeddingTokens(section.text, encoding);

    if (sectionTokens > targetTokens) {
      flush();
      for (const piece of splitOversized(section.text, targetTokens, encoding)) {
        buffer.push({ headingPath: section.headingPath, text: piece });
        flush();
      }
      continue;
    }

    if (bufferTokens + sectionTokens > targetTokens) {
      flush();
    }
    buffer.push({ headingPath: section.headingPath, text: section.text });
    bufferTokens += sectionTokens;
  }
  flush();

  return chunks;
};
