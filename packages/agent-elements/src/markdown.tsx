"use client";

import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { Streamdown } from "streamdown";

import { cn } from "@chia/ui/utils/cn.util";

export interface MarkdownProps {
  text: string;
  /** Still arriving: incomplete blocks are repaired and a caret follows the text. */
  streaming?: boolean;
  className?: string;
}

/**
 * Assistant text as markdown, tolerant of the half-finished syntax a stream produces. The CJK
 * plugin keeps emphasis and strikethrough working across Chinese punctuation.
 */
export const Markdown = ({
  className,
  streaming = false,
  text,
}: MarkdownProps) => (
  <Streamdown
    caret="block"
    className={cn("text-foreground text-[15px] leading-7", className)}
    controls={{
      code: { copy: true, download: false },
      table: false,
      mermaid: false,
    }}
    isAnimating={streaming}
    linkSafety={{ enabled: false }}
    mode={streaming ? "streaming" : "static"}
    plugins={{ cjk, code }}
    shikiTheme={["github-light", "github-dark"]}>
    {text}
  </Streamdown>
);
