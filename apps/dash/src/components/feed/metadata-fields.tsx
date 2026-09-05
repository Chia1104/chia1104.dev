"use client";

import { memo, useId } from "react";

import { Disclosure } from "@heroui/react";

import { DefaultLocaleField } from "./default-locale-field";
import { DescriptionField } from "./description-field";
import { FeedTypeTabs } from "./feed-type-tabs";
import { LocaleTabs } from "./locale-tabs";
import { SlugField } from "./slug-field";
import { TitleField } from "./title-field";

export const MetadataFields = memo(({ feedId }: { feedId?: number }) => {
  const id = useId();

  return (
    <div className="flex w-full flex-col gap-5">
      <LocaleTabs />
      <TitleField id={id} />
      <Disclosure className="border-border rounded-xl border">
        <Disclosure.Heading>
          <Disclosure.Trigger className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium">
            Content settings
            <Disclosure.Indicator />
          </Disclosure.Trigger>
        </Disclosure.Heading>
        <Disclosure.Content>
          <Disclosure.Body className="flex flex-col gap-5 px-2">
            <FeedTypeTabs />
            <SlugField isBound={feedId !== undefined} />
            <DefaultLocaleField />
            <DescriptionField id={id} />
          </Disclosure.Body>
        </Disclosure.Content>
      </Disclosure>
    </div>
  );
});
