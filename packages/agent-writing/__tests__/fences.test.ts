import { describe, expect, it } from "vitest";

import { closeOpenFence, withoutFencedCode } from "../src/markdown/fences.ts";

describe("withoutFencedCode", () => {
  it("removes backtick and tilde fences, whatever their info string", () => {
    expect(
      withoutFencedCode("a\n```ts title=x\ncode\n```\nb\n~~~\nmore\n~~~\nc")
    ).toBe("a\nb\nc");
  });

  it("closes a fence only on a marker at least as long as the one that opened it", () => {
    expect(withoutFencedCode("a\n````md\n```ts\ninner\n```\n````\nb")).toBe(
      "a\nb"
    );
    expect(withoutFencedCode("a\n```\ncode\n~~~\nstill code\n```\nb")).toBe(
      "a\nb"
    );
  });

  it("treats a marker followed by text as an opener, never a closer", () => {
    expect(withoutFencedCode("a\n```\ncode\n```not-a-closer\nstill code")).toBe(
      "a"
    );
  });

  it("leaves a backtick run with a backtick in its info string as prose", () => {
    expect(withoutFencedCode("``` a`b ```\nprose")).toBe("``` a`b ```\nprose");
  });
});

describe("closeOpenFence", () => {
  it("appends the opening marker when the text ends inside a fence", () => {
    expect(closeOpenFence("a\n````ts\ncode")).toBe("a\n````ts\ncode\n````");
    expect(closeOpenFence("a\n~~~\ncode\n```\nmore")).toBe(
      "a\n~~~\ncode\n```\nmore\n~~~"
    );
  });

  it("is not fooled by a marker followed by text", () => {
    expect(closeOpenFence("```\ncode\n```not-a-closer\nprose")).toBe(
      "```\ncode\n```not-a-closer\nprose\n```"
    );
  });

  it("leaves closed text alone", () => {
    expect(closeOpenFence("```\ncode\n```\nprose")).toBe(
      "```\ncode\n```\nprose"
    );
    expect(closeOpenFence("no code")).toBe("no code");
  });
});
