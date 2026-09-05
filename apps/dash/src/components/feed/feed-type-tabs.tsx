"use client";

import { memo } from "react";

import { Tabs } from "@heroui/react";
import { Controller, useFormContext } from "react-hook-form";

import { FEED_TYPE_TABS } from "./constants";
import type { DraftFormValues } from "./draft-form-schema";

export const FeedTypeTabs = memo(() => {
  const form = useFormContext<DraftFormValues>();

  return (
    <Controller
      control={form.control}
      name="type"
      render={({ field }) => (
        <Tabs
          selectedKey={field.value}
          onSelectionChange={(key) => field.onChange(key)}>
          <Tabs.ListContainer>
            <Tabs.List aria-label="Feed type">
              {FEED_TYPE_TABS.map(({ id, icon: Icon, label }) => (
                <Tabs.Tab key={id} id={id}>
                  <div className="flex items-center space-x-2">
                    <Icon className="size-5" />
                    <span>{label}</span>
                  </div>
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
      )}
    />
  );
});

FeedTypeTabs.displayName = "FeedTypeTabs";
