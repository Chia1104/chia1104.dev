"use client";

import { AnimatePresence } from "framer-motion";

import FadeIn from "@chia/ui/fade-in";
import Link from "@chia/ui/link";
import { TextPath } from "@chia/ui/text-path";
import { cn } from "@chia/ui/utils/cn.util";

const WrittenBy = ({
  author,
  className,
  license = true,
}: {
  author: string;
  className?: string;
  license?: boolean;
}) => {
  return (
    <AnimatePresence>
      <FadeIn className={cn(className, "relative max-w-fit")}>
        {(isInView) => (
          <>
            <span className="w-full max-w-[300px]">
              {isInView && (
                <TextPath
                  text={author}
                  svgProps={{
                    viewBox: "0 0 320 100",
                  }}
                />
              )}
            </span>
            <p className="absolute bottom-0 left-0 text-xs flex justify-between w-full">
              {`Written by: ${author}`}
              {license && (
                <Link
                  href="https://creativecommons.org/licenses/by-nc-sa/4.0/"
                  className="text-xs text-foreground-700 flex items-center gap-1">
                  <span className="i-simple-icons-creativecommons size-3" /> CC
                  BY-NC-SA 4.0
                </Link>
              )}
            </p>
          </>
        )}
      </FadeIn>
    </AnimatePresence>
  );
};

export default WrittenBy;
