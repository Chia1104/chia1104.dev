import type { CSSProperties, FC, ComponentPropsWithoutRef } from "react";

import { cn } from "../utils";

interface TextShimmerProps extends ComponentPropsWithoutRef<"p"> {
  shimmerWidth?: number;
}

const TextShimmer: FC<TextShimmerProps> = ({
  children,
  className,
  shimmerWidth = 100,
  ...props
}) => {
  return (
    <p
      style={
        {
          "--shimmer-width": `${shimmerWidth}px`,
        } as CSSProperties
      }
      className={cn(
        "text-neutral-600/50 dark:text-neutral-400/50",
        "animate-cia-shimmer bg-clip-text bg-no-repeat [background-position:0_0] [background-size:var(--shimmer-width)_100%] [transition:background-position_1s_cubic-bezier(.6,.6,0,1)_infinite]",
        "bg-gradient-to-r from-neutral-100 via-black/80 via-50% to-neutral-100 dark:from-neutral-900 dark:via-white/80 dark:to-neutral-900",
        className
      )}
      {...props}>
      {children}
    </p>
  );
};

export default TextShimmer;
