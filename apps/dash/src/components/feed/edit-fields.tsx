"use client";

import { ErrorBoundary } from "@chia/ui/error-boundary";
import { cn } from "@chia/ui/utils/cn.util";

import type { EmbeddingResource } from "@/components/rag/embedding-drawer";

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
  resources?: EmbeddingResource[];
}

export const EditFields = (props: Props) => {
  return (
    <div className={cn("flex flex-col gap-10", props.className)}>
      <MetadataFields
        feedId={props.feedId}
        meta={props.meta}
        resources={props.resources}
      />
      <ErrorBoundary>
        <SwitchEditor />
      </ErrorBoundary>
    </div>
  );
};
