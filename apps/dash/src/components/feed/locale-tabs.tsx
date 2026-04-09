"use client";

import { memo } from "react";

import { Chip, Tabs } from "@heroui/react";
import { Controller, useFormContext } from "react-hook-form";

import type { FormSchema } from "@/store/draft/slices/edit-fields";

import { SUPPORTED_LOCALES } from "./constants";

export const LocaleTabs = memo(() => {
  const form = useFormContext<FormSchema>();
  const defaultLocale = form.watch("defaultLocale");

  return (
    <Controller
      control={form.control}
      name="activeLocale"
      render={({ field }) => (
        <Tabs selectedKey={field.value} onSelectionChange={field.onChange}>
          <Tabs.List aria-label="Locale">
            {SUPPORTED_LOCALES.map((locale) => {
              const isDefault = locale.key === defaultLocale;
              return (
                <Tabs.Tab key={locale.key} id={locale.key}>
                  <div className="flex items-center gap-1.5">
                    <span>{locale.label}</span>
                    {isDefault && (
                      <Chip size="sm" variant="soft" color="accent">
                        <Chip.Label className="text-xs">default</Chip.Label>
                      </Chip>
                    )}
                  </div>
                  <Tabs.Indicator />
                </Tabs.Tab>
              );
            })}
          </Tabs.List>
        </Tabs>
      )}
    />
  );
});
