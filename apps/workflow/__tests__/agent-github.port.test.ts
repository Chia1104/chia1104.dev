import { describe, expect, it, vi } from "vitest";

import { GitHubApiError } from "@chia/integrations/github/source";
import type {
  GitHubContents,
  GitHubSourceClient,
} from "@chia/integrations/github/source";

import { createAgentGitHubPort } from "../src/services/agent-github.port";

/**
 * The port owns the allowlist, the per-turn ref pin and the model-facing error text. The
 * client is injected so no request leaves the test.
 */

const SHA = "0123456789abcdef0123456789abcdef01234567";

const createClient = (
  overrides: Partial<GitHubSourceClient> = {}
): GitHubSourceClient & {
  getRepository: ReturnType<typeof vi.fn>;
  resolveCommit: ReturnType<typeof vi.fn>;
  getContents: ReturnType<typeof vi.fn>;
  getTree: ReturnType<typeof vi.fn>;
} => ({
  getRepository: vi.fn(async (repo: string) => ({
    fullName: repo,
    defaultBranch: "develop",
    private: false,
    description: "A site",
    htmlUrl: `https://github.com/${repo}`,
  })),
  resolveCommit: vi.fn(async () => SHA),
  getContents: vi.fn(async (): Promise<GitHubContents> => ({
    kind: "dir",
    entries: [],
  })),
  getTree: vi.fn(async () => ({ sha: SHA, truncated: false, entries: [] })),
  ...overrides,
});

describe("createAgentGitHubPort allowlist", () => {
  it("refuses a repository outside the allowlist before any request", async () => {
    const client = createClient();
    const port = createAgentGitHubPort({
      allowedRepos: ["chia1104/chia1104.dev"],
      client,
    });

    await expect(port.resolveRef({ repo: "chia1104/other" })).rejects.toThrow(
      "not on the operator's GitHub allowlist"
    );
    await expect(
      port.readFile({ repo: "Chia1104/chia1104.dev", path: "README.md" })
    ).rejects.toThrow("is a directory; list it with github_list_tree");
    expect(client.getRepository).toHaveBeenCalledTimes(1);
    expect(client.getRepository).toHaveBeenCalledWith(
      "chia1104/chia1104.dev",
      undefined
    );
  });

  it("refuses a malformed name without consulting the allowlist", async () => {
    const port = createAgentGitHubPort({
      allowedRepos: ["a/b"],
      client: createClient(),
    });
    await expect(port.resolveRef({ repo: "a/b/c" })).rejects.toThrow(
      "owner/name"
    );
  });
});

describe("createAgentGitHubPort refs", () => {
  it("resolves the default branch once per turn and pins later reads to that sha", async () => {
    const client = createClient({
      getContents: vi.fn(async () => ({
        kind: "file",
        file: {
          path: "README.md",
          sha: "blob",
          size: 5,
          content: Buffer.from("hello"),
          htmlUrl: "https://github.com/a/b/blob/develop/README.md",
        },
      })),
    });
    const port = createAgentGitHubPort({ allowedRepos: ["a/b"], client });

    const ref = await port.resolveRef({ repo: "a/b" });
    const file = await port.readFile({ repo: "a/b", path: "README.md" });

    expect(ref).toMatchObject({
      ref: "develop",
      sha: SHA,
      defaultBranch: "develop",
    });
    expect(client.getRepository).toHaveBeenCalledTimes(1);
    expect(client.resolveCommit).toHaveBeenCalledTimes(1);
    expect(client.getContents).toHaveBeenCalledWith(
      { repo: "a/b", path: "README.md", ref: SHA },
      undefined
    );
    expect(file.url).toBe(`https://github.com/a/b/blob/${SHA}/README.md`);
    expect(file.text).toBe("hello");
  });

  it("does not pin a failed resolution", async () => {
    const client = createClient({
      resolveCommit: vi
        .fn()
        .mockRejectedValueOnce(new GitHubApiError(404, "ref resolution"))
        .mockResolvedValueOnce(SHA),
    });
    const port = createAgentGitHubPort({ allowedRepos: ["a/b"], client });

    await expect(port.resolveRef({ repo: "a/b", ref: "nope" })).rejects.toThrow(
      "a/b at nope was not found on GitHub."
    );
    await expect(
      port.resolveRef({ repo: "a/b", ref: "nope" })
    ).resolves.toMatchObject({
      sha: SHA,
    });
  });
});

describe("createAgentGitHubPort listTree", () => {
  it("narrows a recursive listing to the path and maps git object types", async () => {
    const client = createClient({
      getTree: vi.fn(async () => ({
        sha: SHA,
        truncated: true,
        entries: [
          { path: "src", type: "tree" as const, sha: "t" },
          { path: "src/index.ts", type: "blob" as const, sha: "b", size: 10 },
          { path: "src/vendor", type: "commit" as const, sha: "c" },
          { path: "README.md", type: "blob" as const, sha: "r", size: 1 },
        ],
      })),
    });
    const port = createAgentGitHubPort({ allowedRepos: ["a/b"], client });

    const tree = await port.listTree({
      repo: "a/b",
      path: "src",
      recursive: true,
    });

    expect(client.getTree).toHaveBeenCalledWith(
      { repo: "a/b", sha: SHA, recursive: true },
      undefined
    );
    expect(tree).toMatchObject({
      path: "src",
      truncated: true,
      entries: [
        { path: "src/index.ts", type: "file", size: 10 },
        { path: "src/vendor", type: "submodule" },
      ],
    });
  });

  it("tells the model to read a path that is a file", async () => {
    const client = createClient({
      getContents: vi.fn(async () => ({
        kind: "file",
        file: {
          path: "README.md",
          sha: "blob",
          size: 1,
          content: Buffer.from("x"),
          htmlUrl: "",
        },
      })),
    });
    const port = createAgentGitHubPort({ allowedRepos: ["a/b"], client });

    await expect(
      port.listTree({ repo: "a/b", path: "README.md" })
    ).rejects.toThrow(
      "is a file, not a directory; read it with github_read_file"
    );
  });
});

describe("createAgentGitHubPort readFile", () => {
  const fileClient = (file: { size: number; content: Buffer }) =>
    createClient({
      getContents: vi.fn(async () => ({
        kind: "file",
        file: { path: "bin", sha: "s", htmlUrl: "", ...file },
      })),
    });

  it("refuses a binary blob", async () => {
    const port = createAgentGitHubPort({
      allowedRepos: ["a/b"],
      client: fileClient({ size: 3, content: Buffer.from([0x89, 0x00, 0x0a]) }),
    });
    await expect(port.readFile({ repo: "a/b", path: "bin" })).rejects.toThrow(
      "is a binary file"
    );
  });

  it("refuses a blob the provider withheld for size", async () => {
    const port = createAgentGitHubPort({
      allowedRepos: ["a/b"],
      client: fileClient({ size: 2_000_000, content: Buffer.alloc(0) }),
    });
    await expect(port.readFile({ repo: "a/b", path: "bin" })).rejects.toThrow(
      "above the 1000000-byte limit"
    );
  });

  it("maps a directory and a submodule to a hint, and a 403 to a scope message", async () => {
    const port = createAgentGitHubPort({
      allowedRepos: ["a/b"],
      client: createClient({
        getContents: vi
          .fn()
          .mockResolvedValueOnce({ kind: "dir", entries: [] })
          .mockResolvedValueOnce({
            kind: "other",
            type: "submodule",
            path: "v",
          })
          .mockRejectedValueOnce(new GitHubApiError(403, "contents read")),
      }),
    });

    await expect(port.readFile({ repo: "a/b", path: "src" })).rejects.toThrow(
      "is a directory; list it with github_list_tree"
    );
    await expect(port.readFile({ repo: "a/b", path: "v" })).rejects.toThrow(
      "is a submodule and has no content"
    );
    await expect(port.readFile({ repo: "a/b", path: "x" })).rejects.toThrow(
      "GitHub refused access to a/b/x at 0123456 (HTTP 403)"
    );
  });
});
