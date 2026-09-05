import { getEncoding } from "js-tiktoken";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  countEmbeddingTokensAsync,
  guardEmbeddingInput,
  guardEmbeddingInputs,
  loadTokenizer,
  truncateForEmbeddingExact,
} from "../src/embeddings/tokenizer";
import {
  estimateEmbeddingTokens,
  truncateForEmbedding,
} from "../src/embeddings/utils";

const encoding = getEncoding("cl100k_base");
const exactTokens = (text: string) => encoding.encode(text).length;

/** Traditional Chinese is where the old heuristic under-counted. */
const ZH_TW = "繁體中文的斷詞與檢索，向量搜尋與關鍵字搜尋的混合檢索調校。";
const EN = "Vector search combines dense retrieval with lexical matching. ";
const MIXED = `這篇文章講的是 pgvector 的 HNSW 調校與 ef_search 參數設定。`;
const CODE = [
  "```ts",
  "export const buildEmbeddingInput = (input: { title?: string | null }) => {",
  "  return [input.title].filter(Boolean).join('\\n\\n');",
  "};",
  "```",
].join("\n");

const CASES: [string, string][] = [
  ["pure zh-TW", ZH_TW.repeat(400)],
  ["pure english", EN.repeat(400)],
  ["mixed zh-TW + identifiers", MIXED.repeat(400)],
  ["code heavy", CODE.repeat(200)],
];

describe("estimateEmbeddingTokens", () => {
  it.each(CASES)("never under-counts %s", (_name, text) => {
    // the whole point of the fallback: it may over-count, never under-count
    expect(estimateEmbeddingTokens(text)).toBeGreaterThanOrEqual(
      exactTokens(text)
    );
  });
});

describe("truncateForEmbeddingExact", () => {
  it.each(CASES)("keeps %s within the limit", async (_name, text) => {
    const maxTokens = 500;
    const truncated = await truncateForEmbeddingExact(text, maxTokens);
    expect(exactTokens(truncated)).toBeLessThanOrEqual(maxTokens);
  });

  it("leaves short input untouched", async () => {
    expect(await truncateForEmbeddingExact(ZH_TW, 8000)).toBe(ZH_TW);
  });

  it("truncates much less aggressively than the heuristic for zh-TW", async () => {
    const text = ZH_TW.repeat(400);
    const exact = await truncateForEmbeddingExact(text, 1000);
    const heuristic = truncateForEmbedding(text, 1000);
    expect(exact.length).toBeGreaterThan(heuristic.length);
    expect(exactTokens(heuristic)).toBeLessThanOrEqual(1000);
  });
});

describe("truncateForEmbedding (fallback path)", () => {
  it.each(CASES)("keeps %s within the limit", (_name, text) => {
    const maxTokens = 500;
    expect(
      exactTokens(truncateForEmbedding(text, maxTokens))
    ).toBeLessThanOrEqual(maxTokens);
  });
});

describe("guardEmbeddingInput", () => {
  it("passes input through untouched when within budget", async () => {
    const result = await guardEmbeddingInput(MIXED, { model: "test" });
    expect(result.truncated).toBe(false);
    expect(result.text).toBe(MIXED);
    // an upper bound, not the exact count — small inputs skip the tokenizer
    expect(result.tokenCount).toBeGreaterThanOrEqual(exactTokens(MIXED));
  });

  it("truncates to exactly the limit when over budget", async () => {
    const result = await guardEmbeddingInput(
      ZH_TW.repeat(400),
      { model: "test", label: "doc" },
      300
    );
    expect(result.truncated).toBe(true);
    expect(result.tokenCount).toBe(300);
    expect(exactTokens(result.text)).toBeLessThanOrEqual(300);
  });

  it("preserves order across a batch", async () => {
    const inputs = [MIXED, ZH_TW, EN];
    const results = await guardEmbeddingInputs(inputs, { model: "test" });
    expect(results.map((result) => result.text)).toEqual(inputs);
  });
});

describe("tokenizer lifecycle", () => {
  const importWithConstructorSpy = async () => {
    vi.resetModules();
    const constructor = vi.fn(() => encoding);

    vi.doMock("js-tiktoken/lite", () => ({ Tiktoken: constructor }));

    const fresh = await import("../src/embeddings/tokenizer");
    return { constructor, fresh };
  };

  afterEach(() => {
    vi.doUnmock("js-tiktoken/lite");
    vi.resetModules();
  });

  it("does not construct a tokenizer for inputs the estimate already clears", async () => {
    const { constructor, fresh } = await importWithConstructorSpy();

    // a search query is capped at 256 characters — this stands in for one
    await fresh.guardEmbeddingInput("向量搜尋 pgvector ef_search", {
      model: "text-embedding-3-small",
    });
    await fresh.truncateForEmbeddingExact(MIXED);

    expect(constructor).not.toHaveBeenCalled();
  });

  it("shares one tokenizer only within an oversized batch", async () => {
    const { constructor, fresh } = await importWithConstructorSpy();

    await fresh.guardEmbeddingInputs(
      [ZH_TW.repeat(400), ZH_TW.repeat(400)],
      { model: "test" },
      300
    );

    expect(constructor).toHaveBeenCalledTimes(1);
  });

  it("still truncates correctly through the fast path", async () => {
    // the estimate over-counts, so a value it clears is genuinely within budget
    const result = await guardEmbeddingInput(MIXED, { model: "test" }, 8000);
    expect(result.truncated).toBe(false);
    expect(result.text).toBe(MIXED);
    expect(exactTokens(result.text)).toBeLessThanOrEqual(8000);
    // the reported count is an upper bound, never below the truth
    expect(result.tokenCount).toBeGreaterThanOrEqual(exactTokens(MIXED));
  });
});

describe("loadTokenizer", () => {
  it("does not retain the encoding across calls", async () => {
    const first = await loadTokenizer();
    const second = await loadTokenizer();
    expect(first).not.toBe(second);
  });

  it("counts asynchronously without a caller-held encoding", async () => {
    expect(await countEmbeddingTokensAsync(MIXED)).toBe(exactTokens(MIXED));
  });
});
