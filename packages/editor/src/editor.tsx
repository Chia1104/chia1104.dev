"use client";

import { type FC, type ComponentPropsWithoutRef } from "react";
import { Editor as Novel } from "novel";
import { cn } from "@chia/ui";
import extensions from "./extensions";

const Editor: FC<ComponentPropsWithoutRef<typeof Novel>> = ({
  className,
  ...props
}) => {
  return (
    <Novel
      defaultValue=""
      completionApi="/api/ai/generate"
      {...props}
      className={cn(
        "dark:bg-dark/80 relative w-full overflow-hidden rounded-2xl border border-gray-300  bg-white text-black shadow-lg transition ease-in-out dark:border-gray-700 dark:text-white",
        className
      )}
      extensions={extensions}
    />
  );
};

export default Editor;
