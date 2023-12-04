"use client";

import { type FC, type ComponentPropsWithoutRef } from "react";
import { Editor as Novel } from "novel";
import { cn } from "@chia/ui";

const Editor: FC<ComponentPropsWithoutRef<typeof Novel>> = ({
  className,
  ...props
}) => {
  return (
    <Novel
      defaultValue=""
      completionApi="/api/ai/generate"
      {...props}
      className={cn("c-bg-third w-full rounded-2xl", className)}
      extensions={[]}
    />
  );
};

export default Editor;
