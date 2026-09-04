"use client";

import { memo, useId } from "react";

import { useFormContext } from "react-hook-form";

import { EmbeddingDrawer } from "@/components/rag/embedding-drawer";
import type { EmbeddingResource } from "@/components/rag/embedding-drawer";

import { DefaultLocaleField } from "./default-locale-field";
import { DeleteButton } from "./delete-button";
import { DescriptionField } from "./description-field";
import type { DraftFormValues } from "./draft-form-schema";
import { FeedTypeTabs } from "./feed-type-tabs";
import { LocaleTabs } from "./locale-tabs";
import { MetaChip } from "./meta-chip";
import type { MetaChipProps } from "./meta-chip";
import { SlugField } from "./slug-field";
import { TitleField } from "./title-field";

export const MetadataFields = memo(
  ({
    feedId,
    meta,
    resources,
  }: {
    feedId?: number;
    meta?: MetaChipProps;
    resources?: EmbeddingResource[];
  }) => {
    const id = useId();
    const form = useFormContext<DraftFormValues>();

    return (
      <div className="flex w-full flex-col gap-5">
        <div className="flex items-center justify-between">
          <FeedTypeTabs />
          {feedId ? (
            <div className="flex items-center gap-2">
              <MetaChip {...meta} />
              <EmbeddingDrawer feedId={feedId} resources={resources ?? []} />
              <DeleteButton
                feedId={feedId}
                type={form.watch("type")}
                deleted={!!meta?.deleted}
              />
            </div>
          ) : null}
        </div>

        <SlugField isBound={feedId !== undefined} />

        <DefaultLocaleField />

        <LocaleTabs />

        <TitleField id={id} />

        <DescriptionField id={id} />
      </div>
    );
  }
);
