import type { AgentTool } from "@earendil-works/pi-agent-core";

import { bindTool } from "@chia/agent-runtime/tools";
import type { ToolSpec } from "@chia/agent-runtime/tools";

import type {
  GitHubFile,
  GitHubRef,
  GitHubTreeEntry,
  WritingToolContext,
} from "../types.ts";

import { TOOL_INFO_BY_NAME, TOOL_NAMES } from "./registry.ts";
import { Type, textResult, truncate } from "./schema.ts";

/**
 * Reads of the repositories the operator allowed. Every result names the commit sha the
 * ref resolved to, so the model can cite `path@sha` instead of a branch that moves.
 */

const MAX_FILE_CHARS = 16_000;
const MAX_TREE_ENTRIES = 400;

const RepoSchema = Type.String({
  description:
    "Repository as `owner/name`, or its github.com URL. Must be one the operator allowed.",
  minLength: 3,
});

const RefSchema = Type.Optional(
  Type.String({
    description:
      "Branch, tag or commit sha. Omit for the default branch. Within a turn a branch stays pinned to the commit it first resolved to.",
    minLength: 1,
  })
);

/** `owner/name` from the model's spelling: bare, or any github.com URL into the repository. */
export const normalizeRepo = (input: string): string => {
  const trimmed = input.trim();
  const withoutScheme = trimmed.replace(
    /^(?:https?:\/\/)?(?:www\.)?github\.com\//i,
    ""
  );
  const [owner, name] = withoutScheme.split("/");
  if (!owner || !name) {
    throw new Error(
      `"${input}" is not a repository. Pass \`owner/name\` or the repository's github.com URL.`
    );
  }
  return `${owner}/${name.replace(/\.git$/, "")}`.toLowerCase();
};

const normalizePath = (input: string | undefined): string =>
  (input ?? "")
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/^\.\/+/, "");

const shortSha = (sha: string): string => sha.slice(0, 7);

const describeRef = (ref: GitHubRef): string =>
  `${ref.repo} at ${ref.ref} → ${ref.sha}` +
  (ref.ref === ref.defaultBranch ? " (default branch)" : "") +
  (ref.private ? ", private" : "");

export const githubResolveRefSpec = {
  name: TOOL_NAMES.githubResolveRef,
  label: TOOL_INFO_BY_NAME[TOOL_NAMES.githubResolveRef].label,
  description:
    "Look up an allowed repository and pin a branch, tag or sha to its commit. Returns the " +
    "default branch, description and the commit sha to cite. Call it once per repository " +
    "before browsing; `github_list_tree` and `github_read_file` accept the same `ref`.",
  parameters: Type.Object({
    repo: RepoSchema,
    ref: RefSchema,
  }),
  executionMode: "parallel",
} satisfies ToolSpec;

export const githubResolveRefTool = (context: WritingToolContext): AgentTool =>
  bindTool(githubResolveRefSpec, async (_toolCallId, params, signal) => {
    const ref = await context.connectors.github.resolveRef(
      { repo: normalizeRepo(params.repo), ref: params.ref?.trim() },
      signal
    );
    const lines = [
      describeRef(ref),
      `<${ref.url}>`,
      `Default branch: ${ref.defaultBranch}`,
    ];
    if (ref.description) lines.push(`Description: ${ref.description}`);
    lines.push(
      `Cite files as \`path@${shortSha(ref.sha)}\` and link them at <${ref.url}/blob/${ref.sha}/path>.`
    );
    return textResult(lines.join("\n"), { ...ref });
  });

const formatEntry = (entry: GitHubTreeEntry): string => {
  switch (entry.type) {
    case "dir":
      return `${entry.path}/`;
    case "file":
      return entry.size === undefined
        ? entry.path
        : `${entry.path} (${entry.size} B)`;
    default:
      return `${entry.path} (${entry.type})`;
  }
};

export const githubListTreeSpec = {
  name: TOOL_NAMES.githubListTree,
  label: TOOL_INFO_BY_NAME[TOOL_NAMES.githubListTree].label,
  description:
    "List a directory of an allowed repository at a ref: one level by default, the whole " +
    "subtree with `recursive`. Use it to find the file that implements what the post " +
    "describes, then read it with `github_read_file`.",
  parameters: Type.Object({
    repo: RepoSchema,
    ref: RefSchema,
    path: Type.Optional(
      Type.String({
        description:
          "Directory to list, relative to the repository root. Omit for the root.",
      })
    ),
    recursive: Type.Optional(
      Type.Boolean({
        description: `Include every nested entry. Capped at ${MAX_TREE_ENTRIES} entries; prefer a deeper \`path\` over a recursive root listing on a large repository.`,
        default: false,
      })
    ),
  }),
  executionMode: "parallel",
} satisfies ToolSpec;

export const githubListTreeTool = (context: WritingToolContext): AgentTool =>
  bindTool(githubListTreeSpec, async (_toolCallId, params, signal) => {
    const path = normalizePath(params.path);
    const tree = await context.connectors.github.listTree(
      {
        repo: normalizeRepo(params.repo),
        ref: params.ref?.trim(),
        path,
        recursive: params.recursive ?? false,
      },
      signal
    );
    const shown = tree.entries.slice(0, MAX_TREE_ENTRIES);
    const truncated = tree.truncated || shown.length < tree.entries.length;
    const heading = `${tree.ref.repo}/${path || "(root)"} @ ${shortSha(tree.ref.sha)}${params.recursive ? " (recursive)" : ""}`;
    const body =
      shown.length === 0
        ? "The directory is empty."
        : shown.map(formatEntry).join("\n");
    const footer = truncated
      ? `\n\n… listing truncated at ${shown.length} entries; list a narrower \`path\`.`
      : "";
    return textResult(`# ${heading}\n\n${body}${footer}`, {
      repo: tree.ref.repo,
      ref: tree.ref.ref,
      sha: tree.ref.sha,
      path,
      recursive: params.recursive ?? false,
      count: shown.length,
      truncated,
    });
  });

/** The requested lines, 1-based and inclusive, clamped to the file. */
interface LineSlice {
  text: string;
  startLine: number;
  endLine: number;
  lineCount: number;
}

const sliceLines = (
  text: string,
  startLine: number | undefined,
  endLine: number | undefined
): LineSlice => {
  const lines = text.split("\n");
  const lineCount = lines.length;
  const start = Math.max(1, startLine ?? 1);
  const end = Math.min(lineCount, endLine ?? lineCount);
  if (start > end) {
    throw new Error(
      `Lines ${start}–${end} are outside the file, which has ${lineCount} line(s).`
    );
  }
  return {
    text: lines.slice(start - 1, end).join("\n"),
    startLine: start,
    endLine: end,
    lineCount,
  };
};

const formatFile = (
  file: GitHubFile,
  slice: LineSlice,
  body: string
): string => {
  const range =
    slice.startLine === 1 && slice.endLine === slice.lineCount
      ? `${slice.lineCount} line(s)`
      : `lines ${slice.startLine}–${slice.endLine} of ${slice.lineCount}`;
  return `# ${file.ref.repo}/${file.path} @ ${shortSha(file.ref.sha)} (${range})\n<${file.url}>\n\n${body}`;
};

export const githubReadFileSpec = {
  name: TOOL_NAMES.githubReadFile,
  label: TOOL_INFO_BY_NAME[TOOL_NAMES.githubReadFile].label,
  description:
    "Read a text file from an allowed repository at a ref, optionally a line range. Returns " +
    "the content with its permalink at the resolved commit. Quote code from here, never from " +
    "memory; read the range you need rather than a whole large file.",
  parameters: Type.Object({
    repo: RepoSchema,
    ref: RefSchema,
    path: Type.String({
      description: "File path relative to the repository root.",
      minLength: 1,
    }),
    startLine: Type.Optional(
      Type.Integer({
        description:
          "First line to return (1-based). Omit to start at the top.",
        minimum: 1,
      })
    ),
    endLine: Type.Optional(
      Type.Integer({
        description: "Last line to return, inclusive. Omit to read to the end.",
        minimum: 1,
      })
    ),
  }),
  executionMode: "parallel",
} satisfies ToolSpec;

export const githubReadFileTool = (context: WritingToolContext): AgentTool =>
  bindTool(githubReadFileSpec, async (_toolCallId, params, signal) => {
    const path = normalizePath(params.path);
    if (path.length === 0) {
      throw new Error("`path` must name a file, not the repository root.");
    }
    const file = await context.connectors.github.readFile(
      { repo: normalizeRepo(params.repo), ref: params.ref?.trim(), path },
      signal
    );
    const slice = sliceLines(file.text, params.startLine, params.endLine);
    const body = truncate(slice.text, MAX_FILE_CHARS);
    return textResult(formatFile(file, slice, body.text), {
      repo: file.ref.repo,
      ref: file.ref.ref,
      sha: file.ref.sha,
      path: file.path,
      url: file.url,
      size: file.size,
      startLine: slice.startLine,
      endLine: slice.endLine,
      lineCount: slice.lineCount,
      truncated: body.truncated,
    });
  });
