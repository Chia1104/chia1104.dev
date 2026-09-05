"use client";

import { memo } from "react";

import { FieldError, Input, Label, TextField } from "@heroui/react";
import { Controller, useFormContext } from "react-hook-form";

import type { DraftFormValues } from "./draft-form-schema";

export const TitleField = memo(({ id }: { id: string }) => {
  const form = useFormContext<DraftFormValues>();
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
            placeholder="Untitled"
            {...field}
            value={field.value ?? ""}
          />
          <FieldError>{error?.message}</FieldError>
        </TextField>
      )}
    />
  );
});
