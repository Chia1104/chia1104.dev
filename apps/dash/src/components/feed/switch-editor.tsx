"use client";

import { memo } from "react";

import { Controller, useFormContext } from "react-hook-form";

import useTheme from "@chia/ui/utils/use-theme";

import type { DraftFormValues } from "./draft-form-schema";
import { MarkdownEditor } from "./markdown-editor";

export const SwitchEditor = memo(() => {
  const form = useFormContext<DraftFormValues>();
  const { isDarkMode } = useTheme();

  const activeLocale = form.watch("activeLocale");
  const title = form.watch(`translations.${activeLocale}.title`) ?? "";

  return (
    <div className="relative w-full">
      <Controller
        key={activeLocale}
        control={form.control}
        name={`translations.${activeLocale}.content`}
        render={({ field }) => (
          <MarkdownEditor
            value={field.value ?? ""}
            onChange={field.onChange}
            title={title}
            locale={activeLocale}
            theme={isDarkMode ? "vs-dark" : "light"}
          />
        )}
      />
    </div>
  );
});
