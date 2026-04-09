"use client";

import { ErrorBoundary } from "@chia/ui/error-boundary";
import { cn } from "@chia/ui/utils/cn.util";

import type { MetaChipProps } from "./meta-chip";
import { MetadataFields } from "./metadata-fields";
import { SwitchEditor } from "./switch-editor";

interface Props {
  disabled?: boolean;
  isPending?: boolean;
  className?: string;
  mode?: "edit" | "create";
  token?: string;
  feedId?: number;
  meta?: MetaChipProps;
}

export const EditFields = (props: Props) => {
  return (
    <div className={cn("flex flex-col gap-10", props.className)}>
      <MetadataFields feedId={props.feedId} meta={props.meta} />
      <ErrorBoundary>
        <SwitchEditor />
      </ErrorBoundary>
    </div>
  );
};
