import type { CSSProperties, FC, ComponentPropsWithoutRef } from "react";

import { cn } from "../utils/cn.util";

interface TextShimmerProps extends ComponentPropsWithoutRef<"p"> {
  shimmerWidth?: number;
  /** Off renders plain text in the inherited colour — no gradient, no animation. */
  active?: boolean;
  /** `span` for inline use inside interactive elements, where a `<p>` is invalid. */
  as?: "p" | "span";
  /** Seconds per sweep cycle. */
  duration?: number;
}

const TextShimmer: FC<TextShimmerProps> = ({
  active = true,
  as: Tag = "p",
  children,
  className,
  duration = 8,
  shimmerWidth = 100,
  ...props
}) => {
  if (!active) {
    return (
      <Tag className={className} {...props}>
        {children}
      </Tag>
    );
  }
  const style: CSSProperties & Record<`--${string}`, string> = {
    "--shimmer-width": `${shimmerWidth}px`,
    "--shimmer-duration": `${duration}s`,
  };
  return (
    <Tag
      style={style}
      className={cn(
        "text-neutral-600/50 dark:text-neutral-400/50",
        "animate-cia-shimmer bg-size-[var(--shimmer-width)_100%] bg-clip-text bg-position-[0_0] bg-no-repeat [transition:background-position_1s_cubic-bezier(.6,.6,0,1)_infinite]",
        "bg-linear-to-r from-neutral-100 via-black/80 via-50% to-neutral-100 dark:from-neutral-900 dark:via-white/80 dark:to-neutral-900",
        className
      )}
      {...props}>
      {children}
    </Tag>
  );
};

export default TextShimmer;
