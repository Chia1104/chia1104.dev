"use client";

import { AnimatePresence } from "framer-motion";

import { TextPath, FadeIn } from "@chia/ui";

const WrittenBy = ({
  author,
  className,
}: {
  author: string;
  className?: string;
}) => {
  return (
    <AnimatePresence>
      <FadeIn className={className}>
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
            <p className="absolute bottom-0 left-0 text-xs">{`Written by: ${author}`}</p>
          </>
        )}
      </FadeIn>
    </AnimatePresence>
  );
};

export default WrittenBy;
