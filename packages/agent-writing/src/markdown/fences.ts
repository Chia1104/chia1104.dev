/**
 * Fenced code blocks by CommonMark's rules: a fence opens on three or more backticks or
 * tildes after at most three spaces, a backtick fence's info string holds no backtick, and
 * only a fence of the same character at least as long, followed by nothing, closes it. An
 * unclosed fence runs to the end of the text.
 */

const FENCE_LINE = /^ {0,3}(`{3,}|~{3,})(.*)$/;

interface Fence {
  char: string;
  length: number;
}

const opening = (line: string): Fence | null => {
  const match = FENCE_LINE.exec(line);
  if (!match) return null;
  const [, marker = "", info = ""] = match;
  if (marker.startsWith("`") && info.includes("`")) return null;
  return { char: marker.charAt(0), length: marker.length };
};

const closing = (line: string, fence: Fence): boolean => {
  const match = FENCE_LINE.exec(line);
  if (!match) return false;
  const [, marker = "", rest = ""] = match;
  return (
    marker.startsWith(fence.char) &&
    marker.length >= fence.length &&
    rest.trim() === ""
  );
};

const scan = (text: string) => {
  const prose: string[] = [];
  let open: Fence | null = null;
  for (const line of text.split("\n")) {
    if (open) {
      if (closing(line, open)) open = null;
      continue;
    }
    const fence = opening(line);
    if (fence) {
      open = fence;
      continue;
    }
    prose.push(line);
  }
  return { prose, open };
};

/** The text with every fenced code block, fences included, removed. */
export const withoutFencedCode = (text: string): string =>
  scan(text).prose.join("\n");

/** Closes a fence the end of the text left open, so what follows is not read as code. */
export const closeOpenFence = (text: string): string => {
  const { open } = scan(text);
  return open ? `${text}\n${open.char.repeat(open.length)}` : text;
};
