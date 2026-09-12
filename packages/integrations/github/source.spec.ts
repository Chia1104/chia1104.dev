import { describe, expect, it, vi } from "vitest";

import type { JsonValue } from "@chia/utils/json";

import { GitHubApiError, createGitHubSourceClient } from "./source";

/**
 * Pins the wire shape: bearer auth and API version on every request, the sha media type on
 * ref resolution, path segments encoded, and a base64 body decoded once.
 */

const jsonResponse = (body: JsonValue, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const createFetch = (respond: (request: Request) => Response) => {
  const calls: Request[] = [];
  const fetch = vi.fn(
    async (input: string | URL | Request, init?: RequestInit) => {
      const request = new Request(input, init);
      calls.push(request);
      return respond(request);
    }
  );
  return { calls, fetch };
};

describe("createGitHubSourceClient", () => {
  it("sends bearer auth and the API version, and resolves a ref with the sha media type", async () => {
    const { calls, fetch } = createFetch(
      () => new Response("abc123", { status: 200 })
    );
    const client = createGitHubSourceClient({ token: "tok", fetch });

    const sha = await client.resolveCommit({ repo: "a/b", ref: "feat/x" });

    expect(sha).toBe("abc123");
    const request = calls[0]!;
    expect(request.url).toBe(
      "https://api.github.com/repos/a/b/commits/feat%2Fx"
    );
    expect(request.headers.get("authorization")).toBe("Bearer tok");
    expect(request.headers.get("x-github-api-version")).toBe("2022-11-28");
    expect(request.headers.get("accept")).toBe("application/vnd.github.sha");
  });

  it("reads a file, decoding base64 and encoding each path segment", async () => {
    const { calls, fetch } = createFetch(() =>
      jsonResponse({
        type: "file",
        path: "docs/a b.md",
        sha: "blob",
        size: 5,
        encoding: "base64",
        content: Buffer.from("hello").toString("base64"),
        html_url: "https://github.com/a/b/blob/main/docs/a%20b.md",
      })
    );
    const client = createGitHubSourceClient({ token: "tok", fetch });

    const contents = await client.getContents({
      repo: "a/b",
      path: "docs/a b.md",
      ref: "sha1",
    });

    expect(calls[0]!.url).toBe(
      "https://api.github.com/repos/a/b/contents/docs/a%20b.md?ref=sha1"
    );
    expect(contents).toMatchObject({ kind: "file" });
    if (contents.kind !== "file") throw new Error("expected a file");
    expect(contents.file.content.toString("utf8")).toBe("hello");
  });

  it("returns a directory as entries and a symlink as other", async () => {
    const { fetch } = createFetch((request) =>
      request.url.includes("/contents/src")
        ? jsonResponse([
            {
              name: "index.ts",
              path: "src/index.ts",
              type: "file",
              size: 1,
              sha: "s",
            },
          ])
        : jsonResponse({ type: "symlink", path: "link", target: "x" })
    );
    const client = createGitHubSourceClient({ token: "tok", fetch });

    await expect(
      client.getContents({ repo: "a/b", path: "src", ref: "r" })
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
      client.getContents({ repo: "a/b", path: "link", ref: "r" })
    ).resolves.toEqual({ kind: "other", type: "symlink", path: "link" });
  });

  it("requests a recursive tree and wraps an HTTP failure with its status", async () => {
    const { calls, fetch } = createFetch((request) =>
      request.url.includes("/git/trees/")
        ? jsonResponse({ sha: "t", truncated: false, tree: [] })
        : jsonResponse({ message: "Not Found" }, 404)
    );
    const client = createGitHubSourceClient({ token: "tok", fetch });

    await client.getTree({ repo: "a/b", sha: "t", recursive: true });
    expect(calls[0]!.url).toBe(
      "https://api.github.com/repos/a/b/git/trees/t?recursive=1"
    );

    await expect(client.getRepository("a/missing")).rejects.toMatchObject({
      name: "GitHubApiError",
      status: 404,
    });
    await expect(client.getRepository("a/missing")).rejects.toBeInstanceOf(
      GitHubApiError
    );
  });
});
