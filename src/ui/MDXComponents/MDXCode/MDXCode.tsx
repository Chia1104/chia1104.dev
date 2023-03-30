"use client";

import { useRef, useCallback } from "react";
import type { FC, DetailedHTMLProps, HTMLAttributes } from "react";
import { cn } from "@chia//utils/cn.util";
import { useCopyToClipboard } from "usehooks-ts";
import { toast } from "sonner";

interface MDXCodeProps
  extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  text?: string;
  type?: string;
}

export const MDXCode: FC<MDXCodeProps> = (MDXCodeProps) => {
  const { children, text, type = "info" } = MDXCodeProps;

  return (
    <div className="relative mt-10">
      <div
        className={cn(
          "c-text-secondary absolute -top-5 z-20 rounded-full border-2 px-3 py-1",
          type === "info" && "border-info bg-info/70",
          type === "warning" && "border-warning bg-warning/70",
          type === "success" && "border-success bg-success/70",
          type === "error" && "border-danger bg-danger/70"
        )}>
        {text || "Code info"}
      </div>
      {children}
    </div>
  );
};

export const MDXPre: FC<
  DetailedHTMLProps<HTMLAttributes<HTMLPreElement>, HTMLPreElement>
> = (MDXPreProps) => {
  const { children, ...rest } = MDXPreProps;
  const ref = useRef<HTMLPreElement>(null);
  const [, copy] = useCopyToClipboard();

  const handleCopy = useCallback(() => {
    const source = ref.current?.innerText;
    copy(source ?? "")
      .then((r) => {
        if (r) {
          toast.success("Copied to clipboard.");
        }
      })
      .catch(() => {
        toast.error("Failed to copy to clipboard.");
      });
  }, [copy]);

  return (
    <div className="group relative">
      <button
        className="hover:c-bg-secondary absolute right-0 top-0 mr-3 mt-3 inline-flex rounded-lg p-1 text-sm opacity-0 transition duration-200 ease-in-out group-hover:opacity-100"
        onClick={handleCopy}>
        <span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.7}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        </span>
        <span className="hidden sm:ml-1 sm:block">COPY</span>
      </button>

      <pre
        {...rest}
        className="text:black my-7 w-full overflow-x-auto rounded-xl bg-[#dddddd] p-4 transition scrollbar-thin scrollbar-thumb-secondary scrollbar-thumb-rounded-full ease-in-out dark:bg-code dark:text-white"
        ref={ref}>
        {children}
      </pre>
    </div>
  );
};

export const MDXCodeOrigin: FC<
  DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>
> = (MDXCodeOrionProps) => {
  const { children, ...rest } = MDXCodeOrionProps;
  return (
    <code
      {...rest}
      className="text:black overflow-x-auto rounded bg-[#dddddd] p-0.5 transition ease-in-out dark:bg-code dark:text-white">
      {children}
    </code>
  );
};
