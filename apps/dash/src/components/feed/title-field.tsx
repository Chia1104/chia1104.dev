"use client";

import { memo } from "react";

import { FieldError, Input, Label, TextField } from "@heroui/react";
import { Controller, useFormContext } from "react-hook-form";

import type { FormSchema } from "@/store/draft/slices/edit-fields";

export const TitleField = memo(
  ({ id, disabled }: { id: string; disabled?: boolean }) => {
    const form = useFormContext<FormSchema>();
    const activeLocale = form.watch("activeLocale");

    return (
      <Controller
        key={activeLocale}
        control={form.control}
        name={`translations.${activeLocale}.title`}
        render={({ field, fieldState: { invalid, error } }) => (
          <TextField isInvalid={invalid} isRequired fullWidth>
            <Label htmlFor={`${id}-title-${activeLocale}`}>Title</Label>
            <Input
              id={`${id}-title-${activeLocale}`}
              disabled={disabled}
              placeholder="Untitled"
              {...field}
            />
            <FieldError>{error?.message}</FieldError>
          </TextField>
        )}
      />
    );
  }
);
