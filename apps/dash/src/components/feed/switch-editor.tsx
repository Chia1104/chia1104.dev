"use client";

import { memo } from "react";

import { Controller, useFormContext } from "react-hook-form";

import useTheme from "@chia/ui/utils/use-theme";

import { DraftSelectionMenu } from "@/components/agent/draft-selection-menu";

import type { DraftFormValues } from "./draft-form-schema";
import { MarkdownEditor } from "./markdown-editor";

export interface DraftEditorTarget {
  draftId: number;
  /** Saves pending edits before the agent reads the draft; `false` when blocked on a conflict. */
  flush: () => Promise<boolean>;
}

export const SwitchEditor = memo(
  ({ target }: { target: DraftEditorTarget }) => {
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
              renderSelection={(selection, close) => (
                <DraftSelectionMenu
                  draftId={target.draftId}
                  flush={target.flush}
                  locale={activeLocale}
                  onDone={close}
                  selection={selection}
                />
              )}
            />
          )}
        />
      </div>
    );
  }
);
