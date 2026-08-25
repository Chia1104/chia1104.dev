"use client";

import { useEffect, useMemo, useState } from "react";

import { ShikiStreamTokenizer } from "@shikijs/stream";
import type { ThemedToken } from "shiki";
import { getTokenStyleObject } from "shiki/core";

import { cn } from "@chia/ui/utils/cn.util";

import type { Highlighter } from "./highlighter.ts";
import { loadLanguage, themes } from "./highlighter.ts";

/**
 * Incremental highlighting of text that only ever grows. Each `update` feeds the tokenizer just the
 * suffix appended since the last call; completed lines keep their tokens and grammar state, the
 * unfinished last line is re-tokenized. Anything other than an append restarts from scratch.
 */
export class StreamingHighlight {
  private readonly tokenizer: ShikiStreamTokenizer;
  private consumed = "";

  constructor(highlighter: Highlighter, language: string) {
    this.tokenizer = new ShikiStreamTokenizer({
      highlighter,
      lang: language,
      themes,
      defaultColor: "light-dark()",
    });
  }

  async update(code: string): Promise<ThemedToken[]> {
    if (!code.startsWith(this.consumed)) {
      this.tokenizer.clear();
      this.consumed = "";
    }
    const delta = code.slice(this.consumed.length);
    this.consumed = code;
    if (delta) await this.tokenizer.enqueue(delta);
    return [...this.tokenizer.tokensStable, ...this.tokenizer.tokensUnstable];
  }
}

/**
 * Tokens for `code` in `language`, kept up to date as the text streams in. `null` until the
 * grammar has loaded so the caller can show the raw text meanwhile.
 */
export const useStreamingTokens = (code: string, language: string) => {
  const [grammar, setGrammar] = useState<{
    highlighter: Highlighter;
    language: string;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    void loadLanguage(language).then((loaded) => {
      if (alive) setGrammar(loaded);
    });
    return () => {
      alive = false;
    };
  }, [language]);

  const session = useMemo(
    () =>
      grammar
        ? new StreamingHighlight(grammar.highlighter, grammar.language)
        : null,
    [grammar]
  );

  const [tokens, setTokens] = useState<ThemedToken[] | null>(null);

  useEffect(() => {
    if (!session) return;
    let alive = true;
    void session.update(code).then((next) => {
      if (alive) setTokens(next);
    });
    return () => {
      alive = false;
    };
  }, [session, code]);

  return session ? tokens : null;
};

export interface HighlightedCodeProps {
  code: string;
  language: string;
  className?: string;
}

/** The highlighted `<pre>`; the host wraps it in whatever frame it wants. */
export const HighlightedCode = ({
  className,
  code,
  language,
}: HighlightedCodeProps) => {
  const tokens = useStreamingTokens(code, language);
  return (
    <pre
      className={cn(
        "overflow-x-auto font-mono text-[13px] leading-6",
        className
      )}>
      <code>
        {tokens
          ? tokens.map((token, index) => (
              <span
                key={index}
                style={token.htmlStyle ?? getTokenStyleObject(token)}>
                {token.content}
              </span>
            ))
          : code}
      </code>
    </pre>
  );
};
