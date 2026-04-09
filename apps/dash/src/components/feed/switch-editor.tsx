"use client";

import { memo } from "react";

import { Controller, useFormContext } from "react-hook-form";

import { ContentType } from "@chia/db/types";
import { cn } from "@chia/ui/utils/cn.util";
import useTheme from "@chia/ui/utils/use-theme";

import { useEditFields } from "@/store/draft";
import type { FormSchema } from "@/store/draft/slices/edit-fields";

import { MarkdownEditor } from "./markdown-editor";

export const SwitchEditor = memo(() => {
  const form = useFormContext<FormSchema>();
  const { disabled } = useEditFields();
  const { isDarkMode } = useTheme();

  const contentType = form.watch("contentType") ?? ContentType.Mdx;
  const activeLocale = form.watch("activeLocale");
  const title = form.watch(`translations.${activeLocale}.title`) ?? "";

  return contentType !== ContentType.Mdx ? null : (
    <div className={cn("relative w-full", disabled && "pointer-events-none")}>
      <Controller
        key={activeLocale}
        control={form.control}
        name={`translations.${activeLocale}.content.content`}
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
