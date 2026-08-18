/**
 * MDX/Markdown structure helpers, built on the remark parser (mdast).
 *
 * Kept separate from `chunking.ts` so the concerns stay apart: this module is
 * about document structure (the document card in `utils.ts`, citation anchors
 * at read time), `chunking.ts` is about turning that structure into vectors.
 *
 * Parser, not regexes: the corpus is MDX, and the regex predecessor missed
 * multi-line JSX opening tags, left `{expressions}` in chunk text, and failed
 * to condense fences carrying a meta string (```ts title="x"). Everything here
 * works on node positions over the original source, so the surviving text is
 * the author's text, not a re-serialization.
 *
 * The parser stack is imported dynamically per call: these helpers sit under
 * `utils.ts`, whose constants are on the boot path of every process that
 * touches embeddings, and micromark + acorn have no business in a boot.
 */
import type { Code, Heading, Root, RootContent } from "mdast";

/** Code blocks up to this many lines are kept verbatim in chunks. */
const MAX_CODE_BLOCK_LINES = 24;
/** Longer code blocks keep their head — identifiers, imports, comments live there. */
const CODE_BLOCK_HEAD_LINES = 12;

const loadParser = async () => {
  const [{ unified }, parse, gfm, mdx, { toString: mdastToString }] =
    await Promise.all([
      import("unified"),
      import("remark-parse"),
      import("remark-gfm"),
      import("remark-mdx"),
      import("mdast-util-to-string"),
    ]);
  return {
    mdx: unified().use(parse.default).use(gfm.default).use(mdx.default),
    md: unified().use(parse.default).use(gfm.default),
    toString: mdastToString,
  };
};

type Parser = Awaited<ReturnType<typeof loadParser>>;

/**
 * Parses as MDX, falling back to plain markdown when the source is not valid
 * MDX (a stray `<` or an unclosed tag throws in remark-mdx). The fallback
 * keeps indexing alive for a malformed post — JSX degrades to text — instead
 * of failing the whole run.
 */
const parseDocument = (parser: Parser, source: string): Root => {
  try {
    return parser.mdx.parse(source);
  } catch (error) {
    console.warn(
      "[embeddings] source is not valid MDX, parsing as markdown",
      error
    );
    return parser.md.parse(source);
  }
};

interface SourceEdit {
  start: number;
  end: number;
  replacement: string;
}

const spanOf = (node: {
  position?: { start: { offset?: number }; end: { offset?: number } };
}): { start: number; end: number } | null => {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  return start === undefined || end === undefined ? null : { start, end };
};

const condenseCodeBlock = (node: Code): string => {
  const lines = node.value.replace(/\s+$/, "").split("\n");
  const kept =
    lines.length <= MAX_CODE_BLOCK_LINES
      ? lines
      : [...lines.slice(0, CODE_BLOCK_HEAD_LINES), "…"];
  return ["```" + (node.lang ?? ""), ...kept, "```"].join("\n");
};

/**
 * Collects the source edits that turn MDX into plain markdown, walking the
 * tree recursively. JSX elements and links lose only their tag/wrapper spans,
 * so edits inside their children stay disjoint and everything can be applied
 * in one back-to-front pass.
 */
const collectCleanEdits = (nodes: RootContent[], edits: SourceEdit[]): void => {
  for (const node of nodes) {
    const span = spanOf(node);
    if (!span) {
      continue;
    }

    switch (node.type) {
      case "mdxjsEsm":
      case "mdxFlowExpression":
      case "mdxTextExpression":
        edits.push({ ...span, replacement: "" });
        continue;
      case "mdxJsxFlowElement":
      case "mdxJsxTextElement": {
        const first = node.children[0] && spanOf(node.children[0]);
        const last =
          node.children[node.children.length - 1] &&
          spanOf(node.children[node.children.length - 1]!);
        if (first && last) {
          edits.push({ start: span.start, end: first.start, replacement: "" });
          edits.push({ start: last.end, end: span.end, replacement: "" });
          collectCleanEdits(node.children, edits);
        } else {
          // no children (or none with a position) — drop the element whole
          edits.push({ ...span, replacement: "" });
        }
        continue;
      }
      case "code":
        // always rebuilt: normalizes the fence and drops the meta string
        // (```ts title="…"), which is markup noise to BM25 and the embedding
        edits.push({ ...span, replacement: condenseCodeBlock(node) });
        continue;
      case "image":
      case "imageReference":
        edits.push({ ...span, replacement: node.alt ?? "" });
        continue;
      case "link": {
        const first = node.children[0] && spanOf(node.children[0]);
        const last =
          node.children[node.children.length - 1] &&
          spanOf(node.children[node.children.length - 1]!);
        if (first && last) {
          edits.push({ start: span.start, end: first.start, replacement: "" });
          edits.push({ start: last.end, end: span.end, replacement: "" });
          collectCleanEdits(node.children, edits);
        } else {
          edits.push({ ...span, replacement: "" });
        }
        continue;
      }
      case "html": {
        // raw HTML only appears on the plain-markdown fallback path; keep the
        // inner text, drop the tags
        const text = node.value.replace(/<\/?[A-Za-z][^>]*>/g, "");
        edits.push({ ...span, replacement: text });
        continue;
      }
      default:
        if ("children" in node) {
          collectCleanEdits(
            /* SAFETY: The producer contract guarantees this value satisfies RootContent[]. */ node.children as RootContent[],
            edits
          );
        }
    }
  }
};

/**
 * MDX cleanup that keeps document structure (headings, lists, code fences)
 * so the splitter can respect boundaries. Unlike `stripMdx` (topic-level
 * document vectors), this keeps code content — function names, CLI commands,
 * and error messages are exactly what technical queries search for.
 */
export const cleanMdxKeepStructure = async (
  source: string
): Promise<string> => {
  const parser = await loadParser();
  const tree = parseDocument(parser, source);

  const edits: SourceEdit[] = [];
  collectCleanEdits(tree.children, edits);
  edits.sort((a, b) => b.start - a.start);

  let cleaned = source;
  let lastAppliedStart = Number.POSITIVE_INFINITY;
  for (const edit of edits) {
    // edits are disjoint by construction; skip rather than corrupt if not
    if (edit.end > lastAppliedStart) {
      continue;
    }
    cleaned =
      cleaned.slice(0, edit.start) + edit.replacement + cleaned.slice(edit.end);
    lastAppliedStart = edit.start;
  }

  return cleaned.replace(/\n{3,}/g, "\n\n").trim();
};

export interface MarkdownSection {
  headingPath: string | null;
  /** level of the section's own heading; null for preamble text */
  level: number | null;
  text: string;
}

export interface MarkdownHeading {
  level: number;
  /** plain text, markers stripped — what the rendered page slugs */
  title: string;
  /** `"HNSW > ef_search"` — ancestors joined with the heading itself */
  path: string;
}

const walkHeadings = (
  nodes: RootContent[],
  parser: Parser,
  visit: (heading: Heading, title: string) => void
): void => {
  for (const node of nodes) {
    if (node.type === "heading") {
      visit(node, parser.toString(node).trim());
    } else if ("children" in node && node.type !== "mdxJsxTextElement") {
      walkHeadings(
        /* SAFETY: The producer contract guarantees this value satisfies RootContent[]. */ node.children as RootContent[],
        parser,
        visit
      );
    }
  }
};

/** Every heading in document order, each with its ancestor path. */
export const extractHeadings = async (
  content: string
): Promise<MarkdownHeading[]> => {
  const parser = await loadParser();
  const tree = parseDocument(parser, content);

  const headings: MarkdownHeading[] = [];
  const stack: { level: number; title: string }[] = [];

  walkHeadings(tree.children, parser, (heading, title) => {
    while (
      stack.length > 0 &&
      stack[stack.length - 1]!.level >= heading.depth
    ) {
      stack.pop();
    }
    stack.push({ level: heading.depth, title });
    headings.push({
      level: heading.depth,
      title,
      path: stack.map((entry) => entry.title).join(" > "),
    });
  });

  return headings;
};

/**
 * Splits markdown into sections at top-level heading boundaries, tracking the
 * heading path. Expects cleaned input (`cleanMdxKeepStructure`); sections are
 * verbatim slices of it, so chunk text stays the author's text.
 */
export const splitByHeadings = async (
  content: string
): Promise<MarkdownSection[]> => {
  const parser = await loadParser();
  const tree = parseDocument(parser, content);

  const sections: MarkdownSection[] = [];
  const stack: { level: number; title: string }[] = [];
  let range: { start: number; end: number } | null = null;

  const flush = () => {
    if (!range) {
      return;
    }
    const text = content.slice(range.start, range.end).trim();
    if (text) {
      sections.push({
        headingPath: stack.map((entry) => entry.title).join(" > ") || null,
        level: stack[stack.length - 1]?.level ?? null,
        text,
      });
    }
    range = null;
  };

  for (const node of tree.children) {
    if (node.type === "heading") {
      flush();
      while (stack.length > 0 && stack[stack.length - 1]!.level >= node.depth) {
        stack.pop();
      }
      stack.push({ level: node.depth, title: parser.toString(node).trim() });
      continue;
    }
    const span = spanOf(node);
    if (!span) {
      continue;
    }
    range = range
      ? { start: range.start, end: span.end }
      : { start: span.start, end: span.end };
  }
  flush();

  return sections;
};

export interface HeadingOutlineOptions {
  /** deepest heading level to include; H4+ is usually noise in a document card */
  maxDepth?: number;
  /** hard cap so a pathological document cannot blow the card's size */
  maxHeadings?: number;
}

/**
 * Renders the heading tree as an indented list for the document card.
 *
 * This is what makes the card's length a function of document *structure*
 * rather than document *length* — a 20k-token article and a 2k-token article
 * with the same outline produce the same size input.
 */
export const buildHeadingOutline = async (
  content: string,
  options: HeadingOutlineOptions = {}
): Promise<string> => {
  const maxDepth = options.maxDepth ?? 3;
  const maxHeadings = options.maxHeadings ?? 40;

  const headings = (await extractHeadings(content)).filter(
    (heading) => heading.level <= maxDepth
  );
  if (headings.length === 0) {
    return "";
  }

  // indent relative to the shallowest kept level so an article that starts at
  // H2 is not indented for no reason
  const baseLevel = Math.min(...headings.map((heading) => heading.level));

  return headings
    .slice(0, maxHeadings)
    .map(
      (heading) => `${"  ".repeat(heading.level - baseLevel)}- ${heading.title}`
    )
    .join("\n");
};

const STRIP_SKIP_TYPES = new Set([
  "code",
  "mdxjsEsm",
  "mdxFlowExpression",
  "mdxTextExpression",
]);

/** Block types flattened whole, so inline punctuation keeps its spacing. */
const STRIP_TEXT_BLOCK_TYPES = new Set(["paragraph", "heading", "tableCell"]);

const collectPlainText = (
  nodes: RootContent[],
  parser: Parser,
  parts: string[]
): void => {
  for (const node of nodes) {
    if (STRIP_SKIP_TYPES.has(node.type)) {
      continue;
    }
    if (STRIP_TEXT_BLOCK_TYPES.has(node.type)) {
      const text = parser.toString(node).trim();
      if (text) {
        parts.push(text);
      }
    } else if ("children" in node) {
      collectPlainText(
        /* SAFETY: The producer contract guarantees this value satisfies RootContent[]. */ node.children as RootContent[],
        parser,
        parts
      );
    }
  }
};

/**
 * Flattens MDX/Markdown to plain prose for the document card's body fallback:
 * no code blocks, no markup, no expressions — the topic vector should capture
 * what the post is about, not how it is marked up.
 */
export const stripMdx = async (source: string): Promise<string> => {
  const parser = await loadParser();
  const tree = parseDocument(parser, source);

  const parts: string[] = [];
  collectPlainText(tree.children, parser, parts);
  return parts.join(" ").replace(/\s+/g, " ").trim();
};
