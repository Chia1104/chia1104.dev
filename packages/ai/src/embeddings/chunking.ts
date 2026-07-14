import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { getEncoding } from "js-tiktoken";
import type { Tiktoken } from "js-tiktoken";

/** Target chunk size / overlap in tokens (cl100k_base). */
export const EMBEDDING_CHUNK_TOKENS = 512;
export const EMBEDDING_CHUNK_OVERLAP_TOKENS = 64;

/** Code blocks up to this many lines are kept verbatim in chunks. */
const MAX_CODE_BLOCK_LINES = 24;
/** Longer code blocks keep their head — identifiers, imports, comments live there. */
const CODE_BLOCK_HEAD_LINES = 12;
/** Chunks below this token count carry no signal and are dropped. */
const MIN_CHUNK_TOKENS = 8;

let encoding: Tiktoken | undefined;
const getTokenizer = () => (encoding ??= getEncoding("cl100k_base"));

/** Exact token count for chunk sizing (text-embedding-3-* use cl100k_base). */
export const countEmbeddingTokens = (text: string): number =>
  getTokenizer().encode(text).length;

export interface MarkdownChunk {
  /** 0-based chunk index within the translation */
  chunkIndex: number;
  /** raw chunk text as stored for citation/preview */
  chunkText: string;
  /** e.g. "HNSW > ef_search 調校" */
  headingPath: string | null;
  tokenCount: number;
  /** text actually embedded: title + heading path + chunk */
  embeddingInput: string;
}

/**
 * MDX cleanup that keeps document structure (headings, lists, code fences)
 * so the splitter can respect boundaries. Unlike `stripMdx` (topic-level
 * document vectors), this keeps code content — function names, CLI commands,
 * and error messages are exactly what technical queries search for.
 */
export const cleanMdxKeepStructure = (source: string): string => {
  return source
    .replace(/^(?:import|export)\s[^\n]*$/gm, "") // ESM statements
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang: string, code: string) =>
      condenseCodeBlock(lang, code)
    )
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // images -> alt text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links -> label
    .replace(/<\/?[A-Za-z][^>\n]*>/g, "") // JSX / HTML tags, keep children
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const condenseCodeBlock = (lang: string, code: string): string => {
  const lines = code.replace(/\s+$/, "").split("\n");
  const kept =
    lines.length <= MAX_CODE_BLOCK_LINES
      ? lines
      : [...lines.slice(0, CODE_BLOCK_HEAD_LINES), "…"];
  return ["```" + lang, ...kept, "```"].join("\n");
};

interface MarkdownSection {
  headingPath: string | null;
  text: string;
}

/** Splits cleaned markdown into sections at heading boundaries, tracking the heading path. */
const splitByHeadings = (content: string): MarkdownSection[] => {
  const sections: MarkdownSection[] = [];
  const headingStack: { level: number; title: string }[] = [];
  let buffer: string[] = [];
  let insideCodeFence = false;

  const flush = () => {
    const text = buffer.join("\n").trim();
    if (text) {
      sections.push({
        headingPath:
          headingStack.map((heading) => heading.title).join(" > ") || null,
        text,
      });
    }
    buffer = [];
  };

  for (const line of content.split("\n")) {
    if (/^\s*```/.test(line)) {
      insideCodeFence = !insideCodeFence;
    }
    const heading = insideCodeFence ? null : /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading?.[1] && heading[2]) {
      flush();
      const level = heading[1].length;
      while (
        headingStack.length > 0 &&
        headingStack[headingStack.length - 1]!.level >= level
      ) {
        headingStack.pop();
      }
      headingStack.push({ level, title: heading[2].trim() });
      continue;
    }
    buffer.push(line);
  }
  flush();

  return sections;
};

const buildChunkEmbeddingInput = (params: {
  title?: string | null;
  headingPath: string | null;
  text: string;
}): string => {
  return [
    params.title ? `Title: ${params.title}` : null,
    params.headingPath ? `Section: ${params.headingPath}` : null,
    "",
    params.text,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
};

/**
 * Structure-aware chunking: split at heading boundaries, then let the
 * markdown-aware recursive splitter (LangChain textsplitters) handle
 * oversized sections with token-based sizing and overlap.
 */
export const chunkMarkdownForEmbedding = async (params: {
  title?: string | null;
  content: string;
  chunkTokens?: number;
  overlapTokens?: number;
}): Promise<MarkdownChunk[]> => {
  const cleaned = cleanMdxKeepStructure(params.content);
  if (!cleaned) {
    return [];
  }

  const chunkTokens = params.chunkTokens ?? EMBEDDING_CHUNK_TOKENS;
  const splitter = RecursiveCharacterTextSplitter.fromLanguage("markdown", {
    chunkSize: chunkTokens,
    chunkOverlap: params.overlapTokens ?? EMBEDDING_CHUNK_OVERLAP_TOKENS,
    lengthFunction: countEmbeddingTokens,
  });

  const chunks: MarkdownChunk[] = [];
  for (const section of splitByHeadings(cleaned)) {
    const pieces =
      countEmbeddingTokens(section.text) <= chunkTokens
        ? [section.text]
        : await splitter.splitText(section.text);

    for (const piece of pieces) {
      const text = piece.trim();
      const tokenCount = countEmbeddingTokens(text);
      if (tokenCount < MIN_CHUNK_TOKENS) {
        continue;
      }
      chunks.push({
        chunkIndex: chunks.length,
        chunkText: text,
        headingPath: section.headingPath,
        tokenCount,
        embeddingInput: buildChunkEmbeddingInput({
          title: params.title,
          headingPath: section.headingPath,
          text,
        }),
      });
    }
  }

  return chunks;
};
