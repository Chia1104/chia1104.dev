"use client";

import { memo, useId } from "react";

import { useFormContext } from "react-hook-form";

import { EmbeddingDrawer } from "@/components/rag/embedding-drawer";
import type { EmbeddingResource } from "@/components/rag/embedding-drawer";
import { useEditFields } from "@/store/draft";
import type { FormSchema } from "@/store/draft/slices/edit-fields";

import { DefaultLocaleField } from "./default-locale-field";
import { DeleteButton } from "./delete-button";
import { DescriptionField } from "./description-field";
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
    const form = useFormContext<FormSchema>();
    const { disabled } = useEditFields();

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

        <SlugField />

        <DefaultLocaleField />

        <LocaleTabs />

        <TitleField id={id} disabled={disabled} />

        <DescriptionField id={id} disabled={disabled} />
      </div>
    );
  }
);
