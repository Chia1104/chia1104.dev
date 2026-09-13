import { describe, expect, it, vi } from "vitest";

import type { JsonValue } from "@chia/utils/json";

import { GitHubApiError, createGitHubClient } from "./client";
import { createGitHubSource } from "./source";

/**
 * Pins the wire shape: token auth on every request, ref resolution as one GraphQL query
 * with an annotated tag peeled, contents and trees over REST, and both transports'
 * failures reduced to `GitHubApiError`.
 */

const SHA = "0123456789abcdef0123456789abcdef01234567";

const jsonResponse = (body: JsonValue, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const createSource = (respond: (request: Request) => Response) => {
  const calls: Request[] = [];
  const fetch = vi.fn(
    async (input: string | URL | Request, init?: RequestInit) => {
      const request = new Request(input, init);
      calls.push(request.clone());
      return respond(request);
    }
  );
  return {
    calls,
    source: createGitHubSource(createGitHubClient({ token: "tok", fetch })),
  };
};

const repositoryData = (object: JsonValue) => ({
  data: {
    repository: {
      nameWithOwner: "a/b",
      isPrivate: false,
      description: "A site",
      url: "https://github.com/a/b",
      defaultBranchRef: { name: "develop", target: { oid: SHA } },
      object,
    },
  },
});

describe("createGitHubSource.resolveRef", () => {
  it("asks GraphQL once with the token and peels an annotated tag to its commit", async () => {
    const { calls, source } = createSource(() =>
      jsonResponse(
        repositoryData({ oid: "tag-object", target: { oid: "commit-oid" } })
      )
    );

    const resolved = await source.resolveRef({ repo: "a/b", ref: "v1.0.0" });

    expect(resolved).toEqual({
      fullName: "a/b",
      defaultBranch: "develop",
      private: false,
      description: "A site",
      htmlUrl: "https://github.com/a/b",
      ref: "v1.0.0",
      sha: "commit-oid",
    });
    expect(calls).toHaveLength(1);
    const request = calls[0]!;
    expect(request.method).toBe("POST");
    expect(request.url).toBe("https://api.github.com/graphql");
    expect(request.headers.get("authorization")).toBe("token tok");
    const body: unknown = await request.json();
    expect(body).toMatchObject({
      variables: { owner: "a", name: "b", ref: "v1.0.0", hasRef: true },
    });
  });

  it("uses the default branch when no ref is given", async () => {
    const { calls, source } = createSource(() =>
      jsonResponse(repositoryData(null))
    );

    const resolved = await source.resolveRef({ repo: "a/b" });

    expect(resolved).toMatchObject({ ref: "develop", sha: SHA });
    const body: unknown = await calls[0]!.json();
    expect(body).toMatchObject({ variables: { ref: "", hasRef: false } });
  });

  it("reports a missing repository or ref as 404", async () => {
    const missingRepo = createSource(() =>
      jsonResponse({
        data: { repository: null },
        errors: [{ type: "NOT_FOUND", message: "Could not resolve" }],
      })
    );
    await expect(
      missingRepo.source.resolveRef({ repo: "a/missing" })
    ).rejects.toMatchObject({ name: "GitHubApiError", status: 404 });

    const missingRef = createSource(() => jsonResponse(repositoryData(null)));
    await expect(
      missingRef.source.resolveRef({ repo: "a/b", ref: "nope" })
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("createGitHubSource.getContents", () => {
  it("reads a file at a sha and decodes its base64 body", async () => {
    const { calls, source } = createSource(() =>
      jsonResponse({
        type: "file",
        name: "a b.md",
        path: "docs/a b.md",
        sha: "blob",
        size: 5,
        encoding: "base64",
        content: Buffer.from("hello").toString("base64"),
        url: "",
        git_url: null,
        html_url: null,
        download_url: null,
        _links: { self: "", git: null, html: null },
      })
    );

    const contents = await source.getContents({
      repo: "a/b",
      path: "docs/a b.md",
      ref: SHA,
    });

    const url = new URL(calls[0]!.url);
    expect(decodeURIComponent(url.pathname)).toBe(
      "/repos/a/b/contents/docs/a b.md"
    );
    expect(url.searchParams.get("ref")).toBe(SHA);
    expect(contents).toMatchObject({ kind: "file" });
    if (contents.kind !== "file") throw new Error("expected a file");
    expect(contents.file.content.toString("utf8")).toBe("hello");
    expect(contents.file.size).toBe(5);
  });

  it("returns a directory as entries and a symlink as other", async () => {
    const entry = {
      name: "index.ts",
      path: "src/index.ts",
      type: "file",
      size: 1,
      sha: "s",
      url: "",
      git_url: null,
      html_url: null,
      download_url: null,
      _links: { self: "", git: null, html: null },
    };
    const { source } = createSource((request) =>
      request.url.includes("/contents/src")
        ? jsonResponse([entry])
        : jsonResponse({
            type: "symlink",
            target: "x",
            name: "link",
            path: "link",
            sha: "l",
            size: 1,
            url: "",
            git_url: null,
            html_url: null,
            download_url: null,
            _links: { self: "", git: null, html: null },
          })
    );

    await expect(
      source.getContents({ repo: "a/b", path: "src", ref: "r" })
    ).resolves.toEqual({
      kind: "dir",
      entries: [
        {
          name: "index.ts",
          path: "src/index.ts",
          type: "file",
          size: 1,
          sha: "s",
        },
      ],
    });
    await expect(
      source.getContents({ repo: "a/b", path: "link", ref: "r" })
    ).resolves.toEqual({ kind: "other", type: "symlink", path: "link" });
  });

  it("wraps a REST failure with its status", async () => {
    const { source } = createSource(() =>
      jsonResponse({ message: "Not Found" }, 404)
    );

    await expect(
      source.getContents({ repo: "a/b", path: "nope", ref: "r" })
    ).rejects.toBeInstanceOf(GitHubApiError);
    await expect(
      source.getContents({ repo: "a/b", path: "nope", ref: "r" })
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("createGitHubSource.getTree", () => {
  it("requests a recursive tree and keeps only complete entries", async () => {
    const { calls, source } = createSource(() =>
      jsonResponse({
        sha: "t",
        url: "",
        truncated: true,
        tree: [
          { path: "src", type: "tree", sha: "d", mode: "040000" },
          { path: "src/index.ts", type: "blob", sha: "b", size: 10 },
          { path: "broken", sha: "x" },
        ],
      })
    );

    const tree = await source.getTree({
      repo: "a/b",
      sha: "t",
      recursive: true,
    });

    expect(calls[0]!.url).toBe(
      "https://api.github.com/repos/a/b/git/trees/t?recursive=1"
    );
    expect(tree).toEqual({
      sha: "t",
      truncated: true,
      entries: [
        { path: "src", type: "tree", sha: "d", size: undefined },
        { path: "src/index.ts", type: "blob", sha: "b", size: 10 },
      ],
    });
  });
});
