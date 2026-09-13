import * as z from "zod";

/**
 * Operator preferences the dashboard may change without a deploy. Tool tiers, approval, turn
 * budget and the model allowlist stay in code.
 */

/** Long enough for a page of house rules; the prompt is cached per session, so size is cheap. */
export const WRITING_INSTRUCTIONS_MAX_CHARS = 8_000;

/** Room for a hundred `owner/name` lines; the dashboard renders it as a textarea. */
export const WRITING_GITHUB_REPOS_MAX_CHARS = 4_000;

/** GitHub's own rule for owner and repository names, after lower-casing. */
const GITHUB_REPO_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\/[a-z0-9._-]+$/;

/** The distinct `owner/name` entries of the config text, lower-cased, invalid ones included. */
const gitHubRepoEntries = (text: string | undefined): string[] => [
  ...new Set(
    (text ?? "")
      .split(/[\s,]+/)
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry.length > 0)
  ),
];

export const isGitHubRepo = (entry: string): boolean =>
  GITHUB_REPO_PATTERN.test(entry);

/**
 * The repositories the writing agent may read. The schema already rejected any entry that is
 * not `owner/name`, so this never sees one; a row that predates the rule is filtered anyway.
 */
export const parseGitHubRepos = (text: string | undefined): string[] =>
  gitHubRepoEntries(text).filter(isGitHubRepo);

export const writingConfigSchema = z.object({
  /** Appended to the system prompt under "Operator instructions"; empty means none. */
  instructions: z.string().max(WRITING_INSTRUCTIONS_MAX_CHARS).optional(),
  githubRepos: z
    .string()
    .max(WRITING_GITHUB_REPOS_MAX_CHARS)
    .optional()
    .refine((text) => gitHubRepoEntries(text).every(isGitHubRepo), {
      message:
        "Every entry must be a repository as `owner/name`, separated by newlines or commas.",
    })
    .describe(
      "Repositories the agent may read with its GitHub tools, one `owner/name` per line. Empty allows none."
    ),
});

export type WritingConfig = z.infer<typeof writingConfigSchema>;

export const WRITING_CONFIG_DEFAULTS: WritingConfig = {};
