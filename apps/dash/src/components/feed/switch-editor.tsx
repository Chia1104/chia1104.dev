"use client";

import { memo } from "react";

import { useQuery } from "@tanstack/react-query";
import { useFormContext, useWatch } from "react-hook-form";

import useTheme from "@chia/ui/utils/use-theme";

import { useDraftSelectionActions } from "@/components/agent/draft-selection-actions";
import { orpc } from "@/libs/orpc/client";

import type { DraftFormValues } from "./draft-form-schema";
import { MarkdownEditor } from "./markdown-editor";

export interface DraftEditorTarget {
  draftId: number;
  /** The commit the post holds, which the editor's change bar compares against; `null` before the first apply. */
  appliedRevisionId: number | null;
  /** Saves pending edits before the agent reads the draft; `false` when blocked on a conflict. */
  flush: () => Promise<boolean>;
}

export const SwitchEditor = memo(
  ({ target }: { target: DraftEditorTarget }) => {
    const form = useFormContext<DraftFormValues>();
    const { isDarkMode } = useTheme();

    const activeLocale = form.watch("activeLocale");
    const title = form.watch(`translations.${activeLocale}.title`) ?? "";
    const name = `translations.${activeLocale}.content` as const;
    const content = useWatch({ control: form.control, name }) ?? "";
    const selectionActions = useDraftSelectionActions({
      draftId: target.draftId,
      flush: target.flush,
      locale: activeLocale,
    });
    // A commit never changes, so one read serves until the next apply moves the pointer.
    const applied = useQuery(
      orpc.feeds["draft:revision"].queryOptions({
        input: {
          draftId: target.draftId,
          revisionId: target.appliedRevisionId ?? 0,
        },
        enabled: target.appliedRevisionId !== null,
        staleTime: Infinity,
      })
    );
    const baseline = applied.data
      ? (applied.data.snapshot.translations[activeLocale]?.content ?? "")
      : null;

    return (
      <div className="relative w-full">
        {/* One editor for every locale: the path picks the model, so a switch keeps each
            locale's undo history, cursor and scroll position. */}
        <MarkdownEditor
          path={`draft-${target.draftId}/${activeLocale}.mdx`}
          value={content}
          onChange={(next) =>
            form.setValue(name, next ?? "", { shouldDirty: true })
          }
          title={title}
          locale={activeLocale}
          theme={isDarkMode ? "vs-dark" : "light"}
          selectionActions={selectionActions}
          baseline={baseline}
        />
      </div>
    );
  }
);
