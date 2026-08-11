/**
 * Pure MDX/Markdown structure helpers.
 *
 * Kept separate from `chunking.ts` so the concerns stay apart: this module is
 * about document structure (the document card in `utils.ts`, citation anchors
 * at read time), `chunking.ts` is about turning that structure into vectors.
 */

/** Code blocks up to this many lines are kept verbatim in chunks. */
const MAX_CODE_BLOCK_LINES = 24;
/** Longer code blocks keep their head — identifiers, imports, comments live there. */
const CODE_BLOCK_HEAD_LINES = 12;

const condenseCodeBlock = (lang: string, code: string): string => {
  const lines = code.replace(/\s+$/, "").split("\n");
  const kept =
    lines.length <= MAX_CODE_BLOCK_LINES
      ? lines
      : [...lines.slice(0, CODE_BLOCK_HEAD_LINES), "…"];
  return ["```" + lang, ...kept, "```"].join("\n");
};

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

export interface MarkdownSection {
  headingPath: string | null;
  text: string;
}

export interface MarkdownHeading {
  level: number;
  title: string;
  /** `"HNSW > ef_search"` — ancestors joined with the heading itself */
  path: string;
}

const HEADING_REGEX = /^(#{1,6})\s+(.+)$/;
const FENCE_REGEX = /^\s*```/;

/**
 * Walks lines, tracking fenced code blocks so a `# comment` inside a shell
 * snippet is never mistaken for a heading.
 */
const forEachHeadingLine = (
  content: string,
  visit: (heading: { level: number; title: string }) => void,
  onBody?: (line: string) => void
): void => {
  let insideCodeFence = false;

  for (const line of content.split("\n")) {
    if (FENCE_REGEX.test(line)) {
      insideCodeFence = !insideCodeFence;
    }
    const heading = insideCodeFence ? null : HEADING_REGEX.exec(line);
    if (heading?.[1] && heading[2]) {
      visit({ level: heading[1].length, title: heading[2].trim() });
      continue;
    }
    onBody?.(line);
  }
};

/** Every heading in document order, each with its ancestor path. */
export const extractHeadings = (content: string): MarkdownHeading[] => {
  const headings: MarkdownHeading[] = [];
  const stack: { level: number; title: string }[] = [];

  forEachHeadingLine(content, ({ level, title }) => {
    while (stack.length > 0 && stack[stack.length - 1]!.level >= level) {
      stack.pop();
    }
    stack.push({ level, title });
    headings.push({
      level,
      title,
      path: stack.map((entry) => entry.title).join(" > "),
    });
  });

  return headings;
};

/** Splits cleaned markdown into sections at heading boundaries, tracking the heading path. */
export const splitByHeadings = (content: string): MarkdownSection[] => {
  const sections: MarkdownSection[] = [];
  const headingStack: { level: number; title: string }[] = [];
  let buffer: string[] = [];

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

  forEachHeadingLine(
    content,
    ({ level, title }) => {
      flush();
      while (
        headingStack.length > 0 &&
        headingStack[headingStack.length - 1]!.level >= level
      ) {
        headingStack.pop();
      }
      headingStack.push({ level, title });
    },
    (line) => buffer.push(line)
  );
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
export const buildHeadingOutline = (
  content: string,
  options: HeadingOutlineOptions = {}
): string => {
  const maxDepth = options.maxDepth ?? 3;
  const maxHeadings = options.maxHeadings ?? 40;

  const headings = extractHeadings(content).filter(
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
