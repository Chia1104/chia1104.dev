export interface ParsedSlashCommand {
  name: string;
  args: string[];
}

export interface SlashToken {
  start: number;
  end: number;
  query: string;
}

export interface SlashTokenReplacement {
  text: string;
  cursor: number;
}

export type SlashCommandParseResult =
  | { type: "none" }
  | { type: "command"; command: ParsedSlashCommand }
  | { type: "invalid" };

export type LocatedSlashCommandParseResult =
  | { type: "none" }
  | { type: "command"; command: ParsedSlashCommand; token: SlashToken }
  | { type: "invalid" };

export interface SlashMenuItem {
  id: string;
  kind: "command" | "skill";
  name: string;
  label: string;
  description: string;
  argumentHint?: string;
  local?: boolean;
}

const quoteArgument = (value: string): string =>
  value.length === 0 || /[\s"\\]/.test(value) ? JSON.stringify(value) : value;

const isSlashBoundary = (text: string, index: number): boolean =>
  index === 0 || !/[A-Za-z0-9_./:-]/.test(text[index - 1]!);

export const formatSlashCommand = (
  name: string,
  args: readonly string[]
): string => [`/${name}`, ...args.map(quoteArgument)].join(" ");

export const slashTokenAt = (
  text: string,
  cursor: number
): SlashToken | null => {
  if (cursor < 0 || cursor > text.length) return null;
  const before = text.slice(0, cursor);
  const start = before.lastIndexOf("/");
  if (start < 0 || !isSlashBoundary(text, start)) return null;
  const query = before.slice(start + 1);
  if (/\s|\//.test(query)) return null;

  return { start, end: cursor, query: query.toLowerCase() };
};

export const replaceSlashToken = (
  text: string,
  token: SlashToken,
  replacement: string
): SlashTokenReplacement => {
  let suffixStart = token.end;
  if (
    replacement.endsWith(" ") &&
    (text[suffixStart] === " " || text[suffixStart] === "\t")
  ) {
    suffixStart++;
  }
  return {
    text: text.slice(0, token.start) + replacement + text.slice(suffixStart),
    cursor: token.start + replacement.length,
  };
};

export const removeSlashToken = (
  text: string,
  token: SlashToken
): SlashTokenReplacement => {
  let start = token.start;
  let end = token.end;
  if (
    start > 0 &&
    (text[start - 1] === " " || text[start - 1] === "\t") &&
    end === text.length
  ) {
    start--;
  } else if (text[end] === " " || text[end] === "\t") {
    end++;
  }
  return {
    text: text.slice(0, start) + text.slice(end),
    cursor: start,
  };
};

const tokenizeArguments = (input: string): string[] | null => {
  const args: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let escaping = false;
  let started = false;

  const push = () => {
    if (!started) return;
    args.push(current);
    current = "";
    started = false;
  };

  for (const character of input) {
    if (escaping) {
      current += character;
      escaping = false;
      started = true;
      continue;
    }
    if (character === "\\") {
      escaping = true;
      started = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = null;
      else current += character;
      started = true;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      started = true;
      continue;
    }
    if (/\s/.test(character)) {
      push();
      continue;
    }
    current += character;
    started = true;
  }

  if (escaping || quote) return null;
  push();
  return args;
};

export const parseSlashCommand = (text: string): SlashCommandParseResult => {
  const match = /^\/([^\s]+)(?:\s+([\s\S]*))?$/.exec(text.trim());
  if (!match) return { type: "none" };
  const args = tokenizeArguments(match[2] ?? "");
  if (!args) return { type: "invalid" };
  return {
    type: "command",
    command: { name: match[1]!, args },
  };
};

export const findSlashCommand = (
  text: string,
  names: ReadonlySet<string>
): LocatedSlashCommandParseResult => {
  const pattern = /\/([^\s]+)/g;
  for (const match of text.matchAll(pattern)) {
    if (!isSlashBoundary(text, match.index)) continue;
    const name = match[1]!;
    if (!names.has(name)) continue;
    const start = match.index;
    const end = start + name.length + 1;
    const args = tokenizeArguments(text.slice(end).trim());
    if (!args) return { type: "invalid" };
    return {
      type: "command",
      command: { name, args },
      token: { start, end, query: name.toLowerCase() },
    };
  }
  return { type: "none" };
};

export const filterSlashMenuItems = (
  items: readonly SlashMenuItem[],
  query: string
): SlashMenuItem[] => {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...items];
  return items.filter((item) =>
    `${item.label} ${item.name} ${item.description}`
      .toLowerCase()
      .includes(needle)
  );
};
