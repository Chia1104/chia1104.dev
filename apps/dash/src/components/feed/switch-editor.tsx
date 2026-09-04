"use client";

import { memo } from "react";

import { Controller, useFormContext } from "react-hook-form";

import { cn } from "@chia/ui/utils/cn.util";
import useTheme from "@chia/ui/utils/use-theme";

import { useEditFields } from "@/store/draft";
import type { FormSchema } from "@/store/draft/slices/edit-fields";

import { MarkdownEditor } from "./markdown-editor";

export const SwitchEditor = memo(() => {
  const form = useFormContext<FormSchema>();
  const { disabled } = useEditFields();
  const { isDarkMode } = useTheme();

  const activeLocale = form.watch("activeLocale");
  const title = form.watch(`translations.${activeLocale}.title`) ?? "";

  return (
    <div className={cn("relative w-full", disabled && "pointer-events-none")}>
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
