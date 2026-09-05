"use client";

import { ErrorBoundary } from "@chia/ui/error-boundary";
import { cn } from "@chia/ui/utils/cn.util";

import { MetadataFields } from "./metadata-fields";
import { SwitchEditor } from "./switch-editor";

interface Props {
  className?: string;
  feedId?: number;
}

export const EditFields = (props: Props) => {
  return (
    <div className={cn("flex flex-col gap-10", props.className)}>
      <MetadataFields feedId={props.feedId} />
      <ErrorBoundary>
        <SwitchEditor />
      </ErrorBoundary>
    </div>
  );
};
