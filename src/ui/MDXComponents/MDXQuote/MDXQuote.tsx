"use client";

import type { FC, DetailedHTMLProps, BlockquoteHTMLAttributes } from "react";
import { cn } from "@chia//utils/cn.util";

interface Props
  extends DetailedHTMLProps<
    BlockquoteHTMLAttributes<HTMLQuoteElement>,
    HTMLQuoteElement
  > {
  type?: string;
}

export const MDXQuote: FC<Props> = (props) => {
  const { children, type = "info", ...rest } = props;

  return (
    <>
      <blockquote
        {...rest}
        className={cn(
          "my-10 border-l-4 bg-gradient-to-r p-3",
          type === "tips" && "border-gray-400 from-gray-400/70 to-gray-400/40",
          type === "info" && "border-info from-info/70 to-info/40",
          type === "success" && "border-success from-success/70 to-success/40",
          type === "warning" && "border-warning from-warning/70 to-warning/40",
          type === "error" && "border-danger from-danger/70 to-danger/40"
        )}>
        {children}
      </blockquote>
    </>
  );
};
