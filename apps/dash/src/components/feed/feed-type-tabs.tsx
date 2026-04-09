"use client";

import { memo } from "react";

import { Tabs } from "@heroui/react";
import { Controller, useFormContext } from "react-hook-form";

import type { FormSchema } from "@/store/draft/slices/edit-fields";

import { FEED_TYPE_TABS } from "./constants";

export const FeedTypeTabs = memo(() => {
  const form = useFormContext<FormSchema>();

  return (
    <Controller
      control={form.control}
      name="type"
      render={({ field }) => (
        <Tabs
          selectedKey={field.value}
          onSelectionChange={(key) => field.onChange(key)}>
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
        </Tabs>
      )}
    />
  );
});

FeedTypeTabs.displayName = "FeedTypeTabs";
