import type { ReactNode } from "react";

import { cn } from "@chia/ui/utils/cn.util";

import { PageDescription, PageTitle } from "@/components/commons/ruled";

/** How far the solid recedes, in em of the mark. */
const DEPTH = 0.14;

/** Farthest copy first; enough copies that their outlines read as one surface. */
const LAYER_OFFSETS = Array.from(
  { length: 24 },
  (_, index) => (24 - index) / 24
);

/**
 * Display text drawn as an oblique solid standing on the rule below it. The copies step up and to
 * the right, the direction the hatch strokes run, so their accent hatching joins into the receding
 * faces. Each copy trims its own line box, since `text-box-trim` does not inherit, and the top
 * margin reserves the height the solid rises above the capitals.
 */
export const ExtrudedMark = ({
  text,
  className,
}: {
  text: string;
  className?: string;
}) => (
  <p
    aria-hidden
    className={cn(
      "relative isolate inline-block text-[length:min(28cqw,16rem)] leading-none font-black tracking-tighter italic select-none [--hatch-color:var(--accent-ink)]",
      className
    )}
    style={{ marginTop: `${DEPTH}em` }}>
    {LAYER_OFFSETS.map((offset) => (
      <span
        key={offset}
        className="hatch absolute inset-0 bg-clip-text text-transparent [text-box:trim-both_cap_alphabetic]"
        style={{ translate: `${offset * DEPTH}em ${-offset * DEPTH}em` }}>
        {text}
      </span>
    ))}
    <span className="text-foreground relative block [text-box:trim-both_cap_alphabetic]">
      {text}
    </span>
  </p>
);

/** A page that stands in for missing or failed content: the mark stands on the title's rule. */
export const StatusSheet = ({
  mark,
  title,
  description,
  children,
}: {
  mark: string;
  title: string;
  description: string;
  children: ReactNode;
}) => (
  <>
    <div className="px-4 pt-10">
      <ExtrudedMark text={mark} />
    </div>
    <PageTitle>{title}</PageTitle>
    <PageDescription>{description}</PageDescription>
    <div className="rule-b flex flex-wrap gap-2 px-4 py-3">{children}</div>
  </>
);
