import type { ComponentProps } from "react";

import { cn } from "@chia/ui/utils/cn.util";

/** A section of the ruled column, closed by a hairline at each edge. */
export const Panel = ({ className, ...props }: ComponentProps<"section">) => (
  <section className={cn("rule-t rule-b", className)} {...props} />
);

export const PanelHeader = ({
  className,
  ...props
}: ComponentProps<"header">) => (
  <header
    className={cn("rule-b flex flex-col gap-1 px-4 py-3", className)}
    {...props}
  />
);

export const PanelTitle = ({ className, ...props }: ComponentProps<"h2">) => (
  <h2
    className={cn(
      "text-xl leading-snug font-semibold tracking-tight text-balance",
      className
    )}
    {...props}
  />
);

export const PanelDescription = ({
  className,
  ...props
}: ComponentProps<"p">) => (
  <p
    className={cn("text-muted text-sm leading-relaxed text-pretty", className)}
    {...props}
  />
);

export const PanelBody = ({ className, ...props }: ComponentProps<"div">) => (
  <div className={cn("p-4", className)} {...props} />
);

/** The hatched break between two panels. */
export const Band = ({ className }: { className?: string }) => (
  <div aria-hidden className={cn("hatch-band h-8", className)} />
);

/** A page's title row, ruled on both edges so it reads as the head of the sheet. */
export const PageTitle = ({ className, ...props }: ComponentProps<"h1">) => (
  <h1
    className={cn(
      "rule-t rule-b px-4 py-2 text-3xl leading-tight font-semibold tracking-tight text-balance",
      className
    )}
    {...props}
  />
);

export const PageDescription = ({
  className,
  ...props
}: ComponentProps<"p">) => (
  <p
    className={cn(
      "rule-b text-muted px-4 py-3 leading-relaxed text-pretty",
      className
    )}
    {...props}
  />
);

/**
 * A cell of a ruled grid that is one column wide, two from `page-md`: hairlines run between
 * cells only, since the rails and the grid's own rules draw the outer edges.
 */
export const RULED_CELL_CLASS_NAME =
  "border-separator page-md:odd:border-r border-b last:border-b-0 page-md:[&:nth-last-child(2):nth-child(odd)]:border-b-0";

/** Hatches the empty slot left by an odd number of cells in a two-column ruled grid. */
export const RuledGridFiller = ({ count }: { count: number }) =>
  count % 2 === 1 ? (
    <li aria-hidden className="hatch page-md:block hidden" />
  ) : null;

/** Accent hatching behind a whole-cell link, shown while it is hovered or focused. */
export const LinkHatch = () => (
  <span
    aria-hidden
    className="hatch absolute inset-0 -z-1 opacity-0 transition-opacity duration-200 [--hatch-color:var(--color-accent)] group-hover/cell:opacity-100 group-focus-visible/cell:opacity-100 motion-reduce:transition-none dark:[--hatch-color:color-mix(in_oklab,var(--color-accent)_25%,transparent)]"
  />
);

/** Classes for a link that fills its ruled cell; pair it with `LinkHatch`. */
export const CELL_LINK_CLASS_NAME =
  "group/cell focus-visible:ring-focus relative isolate outline-none focus-visible:ring-2 focus-visible:ring-inset";
