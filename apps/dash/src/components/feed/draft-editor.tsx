"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AlertDialog, Button, Chip, Form, Spinner } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ORPCError } from "@orpc/client";
import { useDebouncedCallback } from "@tanstack/react-pacer";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormProvider, useForm } from "react-hook-form";

import { Locale } from "@chia/db/types";
import type { Locale as LocaleType } from "@chia/db/types";
import { ErrorBoundary } from "@chia/ui/error-boundary";
import dayjs from "@chia/utils/day";

import { orpc } from "@/libs/orpc/client";
import type { RouterInputs, RouterOutputs } from "@/libs/orpc/types";

import { DraftActions } from "./draft-actions";
import { draftFormSchema } from "./draft-form-schema";
import type { DraftFormValues } from "./draft-form-schema";
import { EditFields } from "./edit-fields";

/**
 * The draft is shared with the writing agent, so every save is a compare-and-set on the
 * revision this form last loaded. A stale save opens the conflict dialog; a newer revision
 * seen while polling refreshes an idle form and warns a dirty one.
 */

export type DraftView = RouterOutputs["feeds"]["draft:get"];
type PatchInput = RouterInputs["feeds"]["draft:patch"];
type DraftValues = Omit<DraftFormValues, "activeLocale">;
type TranslationValues = NonNullable<DraftValues["translations"][LocaleType]>;

const LOCALES = [Locale.zhTW, Locale.En] as const;
const META_FIELDS = ["slug", "type", "defaultLocale", "mainImage"] as const;
const TRANSLATION_FIELDS = [
  "title",
  "excerpt",
  "description",
  "summary",
  "content",
] as const;
const AUTOSAVE_WAIT_MS = 1000;
/** Picks up agent turns that ended; the agent does not push to the editor. */
const POLL_INTERVAL_MS = 5000;

const emptyTranslation = (): TranslationValues => ({
  title: null,
  excerpt: null,
  description: null,
  summary: null,
  content: null,
});

const toValues = (draft: DraftView): DraftValues => ({
  slug: draft.slug,
  type: draft.type,
  defaultLocale: draft.defaultLocale,
  mainImage: draft.mainImage,
  translations: Object.fromEntries(
    LOCALES.map((locale) => [
      locale,
      { ...emptyTranslation(), ...draft.translations[locale] },
    ])
  ),
});

type FieldValue = string | null | undefined;

const same = (a: FieldValue, b: FieldValue) => (a ?? null) === (b ?? null);

/** Only what moved since `base`, so the revision trail records the fields actually touched. */
const diffValues = (
  next: DraftValues,
  base: DraftValues
): Omit<PatchInput, "draftId" | "expectedRevision"> | null => {
  const patch: Omit<PatchInput, "draftId" | "expectedRevision"> = {};
  let changed = false;
  for (const field of META_FIELDS) {
    if (!same(next[field], base[field])) {
      Object.assign(patch, { [field]: next[field] });
      changed = true;
    }
  }
  const translations: NonNullable<PatchInput["translations"]> = {};
  for (const locale of LOCALES) {
    const current = next.translations[locale];
    const previous = base.translations[locale];
    if (!current) continue;
    const localePatch: Partial<TranslationValues> = {};
    let localeChanged = false;
    for (const field of TRANSLATION_FIELDS) {
      if (!same(current[field], previous?.[field])) {
        localePatch[field] = current[field];
        localeChanged = true;
      }
    }
    if (localeChanged) {
      translations[locale] = localePatch;
      changed = true;
    }
  }
  if (Object.keys(translations).length > 0) patch.translations = translations;
  return changed ? patch : null;
};

const applyPatch = (
  base: DraftValues,
  patch: Omit<PatchInput, "draftId" | "expectedRevision">
): DraftValues => {
  const { translations, ...meta } = patch;
  const next: DraftValues = {
    ...base,
    ...meta,
    translations: { ...base.translations },
  };
  for (const locale of LOCALES) {
    const localePatch = translations?.[locale];
    if (!localePatch) continue;
    next.translations[locale] = {
      ...emptyTranslation(),
      ...base.translations[locale],
      ...localePatch,
    };
  }
  return next;
};

type SaveState =
  | { kind: "saved"; revision: number; at: Date }
  | { kind: "dirty" }
  | { kind: "saving" }
  | { kind: "conflict"; draft: DraftView }
  | { kind: "error"; message: string };

const SaveStatus = ({
  state,
  remoteChanged,
}: {
  state: SaveState;
  remoteChanged: boolean;
}) => {
  if (remoteChanged) {
    return (
      <Chip color="warning" size="sm" variant="soft">
        <Chip.Label>Changed elsewhere; your next save will ask</Chip.Label>
      </Chip>
    );
  }
  switch (state.kind) {
    case "saved":
      return (
        <span className="text-muted text-xs">
          Saved · revision {state.revision} ·{" "}
          {dayjs(state.at).format("HH:mm:ss")}
        </span>
      );
    case "dirty":
      return <span className="text-muted text-xs">Unsaved changes</span>;
    case "saving":
      return (
        <span className="text-muted flex items-center gap-1 text-xs">
          <Spinner size="sm" /> Saving
        </span>
      );
    case "conflict":
      return (
        <Chip color="danger" size="sm" variant="soft">
          <Chip.Label>Conflict</Chip.Label>
        </Chip>
      );
    case "error":
      return (
        <Chip color="danger" size="sm" variant="soft">
          <Chip.Label>{state.message}</Chip.Label>
        </Chip>
      );
  }
};

const DraftForm = ({ initial }: { initial: DraftView }) => {
  const queryClient = useQueryClient();
  const draftQueryOptions = useMemo(
    () =>
      orpc.feeds["draft:get"].queryOptions({
        input: { draftId: initial.id },
        initialData: initial,
        refetchInterval: POLL_INTERVAL_MS,
        refetchOnWindowFocus: true,
      }),
    [initial]
  );
  const draftQuery = useQuery(draftQueryOptions);
  const draft = draftQuery.data;

  // What the server holds as far as this form knows. Diffs are taken against it.
  const savedRef = useRef<{ values: DraftValues; revision: number }>({
    values: toValues(initial),
    revision: initial.revision,
  });
  const inFlightRef = useRef(false);
  const queuedRef = useRef(false);
  const [saveState, setSaveState] = useState<SaveState>({
    kind: "saved",
    revision: initial.revision,
    at: new Date(initial.updatedAt),
  });
  const conflict = saveState.kind === "conflict" ? saveState.draft : null;

  const form = useForm<DraftFormValues>({
    defaultValues: {
      ...toValues(initial),
      activeLocale: initial.defaultLocale,
    },
    resolver: zodResolver(draftFormSchema),
  });

  const currentValues = useCallback((): DraftValues => {
    const { activeLocale: _active, ...values } = form.getValues();
    return values;
  }, [form]);

  /** Replaces the form and the saved snapshot with what the server holds. */
  const adopt = useCallback(
    (next: DraftView) => {
      const values = toValues(next);
      savedRef.current = { values, revision: next.revision };
      form.reset({ ...values, activeLocale: form.getValues("activeLocale") });
      queryClient.setQueryData(draftQueryOptions.queryKey, next);
      setSaveState({
        kind: "saved",
        revision: next.revision,
        at: new Date(next.updatedAt),
      });
    },
    [draftQueryOptions.queryKey, form, queryClient]
  );

  const { mutateAsync: patchDraft } = useMutation(
    orpc.feeds["draft:patch"].mutationOptions()
  );

  const flush = useCallback(async () => {
    if (inFlightRef.current) {
      queuedRef.current = true;
      return;
    }
    const patch = diffValues(currentValues(), savedRef.current.values);
    if (!patch) return;
    inFlightRef.current = true;
    setSaveState({ kind: "saving" });
    try {
      const next = await patchDraft({
        draftId: initial.id,
        expectedRevision: savedRef.current.revision,
        ...patch,
      });
      savedRef.current = {
        values: applyPatch(savedRef.current.values, patch),
        revision: next.revision,
      };
      queryClient.setQueryData(draftQueryOptions.queryKey, next);
      setSaveState({
        kind: "saved",
        revision: next.revision,
        at: new Date(next.updatedAt),
      });
    } catch (error) {
      if (error instanceof ORPCError && error.code === "CONFLICT") {
        const latest = await queryClient.query(
          orpc.feeds["draft:get"].queryOptions({
            input: { draftId: initial.id },
          })
        );
        queuedRef.current = false;
        setSaveState({ kind: "conflict", draft: latest });
      } else {
        setSaveState({
          kind: "error",
          message: error instanceof Error ? error.message : "Save failed",
        });
      }
    } finally {
      inFlightRef.current = false;
      if (queuedRef.current) {
        queuedRef.current = false;
        void flush();
      }
    }
  }, [
    currentValues,
    draftQueryOptions.queryKey,
    initial.id,
    patchDraft,
    queryClient,
  ]);

  const scheduleSave = useDebouncedCallback(() => void flush(), {
    wait: AUTOSAVE_WAIT_MS,
  });

  useEffect(() => {
    return form.subscribe({
      formState: { values: true },
      callback: ({ name }) => {
        if (!name || name === "activeLocale" || conflict) return;
        setSaveState((state) =>
          state.kind === "saving" ? state : { kind: "dirty" }
        );
        scheduleSave();
      },
    });
  }, [conflict, form, scheduleSave]);

  // A newer revision from polling: adopt it when nothing is pending here, warn otherwise.
  useEffect(() => {
    if (conflict || draft.revision <= savedRef.current.revision) return;
    const dirty = diffValues(currentValues(), savedRef.current.values) !== null;
    if (dirty || inFlightRef.current) return;
    adopt(draft);
  }, [adopt, conflict, currentValues, draft]);

  const keepMine = useCallback(async () => {
    if (!conflict) return;
    const mine = diffValues(currentValues(), savedRef.current.values);
    const server = conflict;
    if (!mine) {
      adopt(server);
      return;
    }
    // My edits over the server's state; fields I did not touch take the server's version.
    const merged = applyPatch(toValues(server), mine);
    form.reset({ ...merged, activeLocale: form.getValues("activeLocale") });
    savedRef.current = { values: toValues(server), revision: server.revision };
    setSaveState({ kind: "dirty" });
    await flush();
  }, [adopt, conflict, currentValues, flush, form]);

  const takeTheirs = useCallback(() => {
    if (!conflict) return;
    const server = conflict;
    adopt(server);
  }, [adopt, conflict]);

  const remoteChanged =
    conflict === null &&
    draft.revision > savedRef.current.revision &&
    (inFlightRef.current ||
      diffValues(currentValues(), savedRef.current.values) !== null);

  return (
    <FormProvider {...form}>
      <Form
        onSubmit={(event) => {
          event.preventDefault();
          void flush();
        }}
        className="flex w-full flex-col gap-10">
        <DraftActions
          draft={draft}
          onDraftChanged={adopt}
          status={
            <SaveStatus remoteChanged={remoteChanged} state={saveState} />
          }
        />
        <EditFields
          feedId={draft.feedId ?? undefined}
          meta={undefined}
          resources={undefined}
        />
      </Form>

      <AlertDialog
        isOpen={conflict !== null}
        onOpenChange={(open) => {
          if (!open) void keepMine();
        }}>
        <AlertDialog.Backdrop>
          <AlertDialog.Container>
            <AlertDialog.Dialog className="sm:max-w-[440px]">
              <AlertDialog.Header>
                <AlertDialog.Icon status="warning" />
                <AlertDialog.Heading>
                  Draft changed elsewhere
                </AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <p>
                  The draft moved to revision {conflict?.revision} while you
                  were editing, most likely from the writing agent. Keep your
                  edits over the newer version, or drop them and load it.
                </p>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button onPress={takeTheirs} variant="tertiary">
                  Load theirs
                </Button>
                <Button onPress={() => void keepMine()} variant="primary">
                  Keep mine
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </FormProvider>
  );
};

export const DraftEditor = ({ draft }: { draft: DraftView }) => (
  <ErrorBoundary>
    <DraftForm key={draft.id} initial={draft} />
  </ErrorBoundary>
);
