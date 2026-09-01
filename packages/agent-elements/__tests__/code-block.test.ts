import { describe, expect, it } from "vitest";
import { StreamingHighlight } from "../src/code-block.tsx";
import { loadLanguage, resolveLanguage } from "../src/highlighter.ts";

const text = (tokens: { content: string }[]) =>
  tokens.map((t) => t.content).join("");

describe("resolveLanguage", () => {
  it("maps aliases and ids to bundled languages", () => {
    expect(resolveLanguage("ts")).toBe("typescript");
    expect(resolveLanguage("TSX")).toBe("tsx");
    expect(resolveLanguage("javascript")).toBe("javascript");
  });

  it("falls back to plain text for unknown languages", () => {
    expect(resolveLanguage("")).toBe("text");
    expect(resolveLanguage("not-a-language")).toBe("text");
  });
});

describe("StreamingHighlight", () => {
  it("tokens always concatenate to the code seen so far", async () => {
    const { highlighter, language } = await loadLanguage("ts");
    const session = new StreamingHighlight(highlighter, language);
    const source = 'const a = "x";\nfunction f() {\n  return a;\n}\n';
    for (let i = 1; i <= source.length; i += 3) {
      const code = source.slice(0, i);
      expect(text(await session.update(code))).toBe(code);
    }
    expect(text(await session.update(source))).toBe(source);
  });

  it("colours completed lines by grammar, not as plain text", async () => {
    const { highlighter, language } = await loadLanguage("ts");
    const session = new StreamingHighlight(highlighter, language);
    const tokens = await session.update("const a = 1;\n");
    const keyword = tokens.find((t) => t.content === "const");
    expect(keyword?.htmlStyle?.["--shiki-light"]).toBeDefined();
    expect(keyword?.htmlStyle?.["--shiki-dark"]).toBeDefined();
    expect(keyword?.htmlStyle?.["--shiki-light"]).not.toBe(
      tokens.find((t) => t.content === "1")?.htmlStyle?.["--shiki-light"]
    );
  });

  it("restarts when the text is not an extension of what was seen", async () => {
    const { highlighter, language } = await loadLanguage("ts");
    const session = new StreamingHighlight(highlighter, language);
    await session.update("const a = 1;\nconst b");
    const tokens = await session.update("let c = 2;\n");
    expect(text(tokens)).toBe("let c = 2;\n");
  });

  it("streams unknown languages as plain text", async () => {
    const { highlighter, language } = await loadLanguage("nope");
    const session = new StreamingHighlight(highlighter, language);
    expect(text(await session.update("hello\nworld"))).toBe("hello\nworld");
  });
});
