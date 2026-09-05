"use client";

import { memo, useId } from "react";

import { Label, ListBox, Select } from "@heroui/react";
import { Controller, useFormContext } from "react-hook-form";

import { SUPPORTED_LOCALES } from "./constants";
import type { DraftFormValues } from "./draft-form-schema";

export const DefaultLocaleField = memo(() => {
  const id = useId();
  const form = useFormContext<DraftFormValues>();

  return (
    <Controller
      control={form.control}
      name="defaultLocale"
      render={({ field, fieldState }) => (
        <div className="flex w-1/2 flex-col gap-1">
          <Label htmlFor={`${id}-defaultLocale`}>Default Locale</Label>
          <Select
            id={`${id}-defaultLocale`}
            value={field.value ?? undefined}
            onChange={(key) => {
              if (key) {
                field.onChange(key);
              }
            }}
            isInvalid={fieldState.invalid}
            placeholder="Select default locale">
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {SUPPORTED_LOCALES.map((locale) => (
                  <ListBox.Item key={locale.key} id={locale.key}>
                    {locale.label}
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
          {fieldState.error && (
            <p className="px-1 text-xs text-red-500">
              {fieldState.error.message}
            </p>
          )}
        </div>
      )}
    />
  );
});
