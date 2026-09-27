import type { ReactNode } from "react";

import type { Glyph } from "@/components/commons/isometric-mark";
import { IsometricMark } from "@/components/commons/isometric-mark";
import { PageDescription, PageTitle } from "@/components/commons/ruled";

/** A page that stands in for missing or failed content: a figure of the status, then the title's rule. */
export const StatusSheet = ({
  glyphs,
  title,
  description,
  children,
}: {
  glyphs: readonly Glyph[];
  title: string;
  description: string;
  children: ReactNode;
}) => (
  <>
    <figure className="overflow-hidden px-4 py-8">
      <IsometricMark glyphs={glyphs} className="block h-auto max-h-88 w-full" />
    </figure>
    <PageTitle>{title}</PageTitle>
    <PageDescription>{description}</PageDescription>
    <div className="rule-b flex flex-wrap gap-2 px-4 py-3">{children}</div>
  </>
);
