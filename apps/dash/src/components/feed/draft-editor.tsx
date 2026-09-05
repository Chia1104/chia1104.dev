"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";

import { AlertDialog, Button, Chip, Form, Spinner } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";

import { useProvideAgentContext } from "@chia/agent-elements/context";
import { ErrorBoundary } from "@chia/ui/error-boundary";
import dayjs from "@chia/utils/day";

import { orpc } from "@/libs/orpc/client";

import { DraftActions } from "./draft-actions";
import { draftFormSchema } from "./draft-form-schema";
import type { DraftFormValues } from "./draft-form-schema";
import { toValues } from "./draft-values";
import type { DraftView } from "./draft-values";
import { EditFields } from "./edit-fields";
import { useDraftAutosave } from "./use-draft-autosave";
import { useDraftWatch } from "./use-draft-watch";

// The watch stream carries changes; polling covers a disconnected stream.
const POLL_INTERVAL_MS = 60_000;

const DraftForm = ({ initial }: { initial: DraftView }) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useForm<DraftFormValues>({
    defaultValues: {
      ...toValues(initial),
      activeLocale: initial.defaultLocale,
    },
    resolver: zodResolver(draftFormSchema),
  });
  const onSaved = useCallback(
    (next: DraftView) => {
      queryClient.setQueryData(
        orpc.feeds["draft:get"].queryOptions({ input: { draftId: initial.id } })
          .queryKey,
        (current) =>
          current && current.revision > next.revision ? current : next
      );
    },
    [initial.id, queryClient]
  );
  const loadLatest = useCallback(
    () =>
      queryClient.query(
        orpc.feeds["draft:get"].queryOptions({
          input: { draftId: initial.id },
          staleTime: 0,
        })
      ),
    [initial.id, queryClient]
  );
  const autosave = useDraftAutosave({ initial, form, onSaved, loadLatest });
  const { receive } = autosave;
  const { data: draft } = useQuery(
    orpc.feeds["draft:get"].queryOptions({
      input: { draftId: initial.id },
      initialData: initial,
      refetchInterval: POLL_INTERVAL_MS,
      refetchOnWindowFocus: true,
    })
  );

  // Reconcile external query updates without replacing local edits or pending writes.
  useEffect(
    () => receive(draft),
    [draft, receive, autosave.isDirty, autosave.isSaving]
  );

  // The agent drawer lists this draft and sends it with every prompt while the editor is open.
  useProvideAgentContext({
    type: "draft",
    id: draft.id,
    label:
      draft.translations[draft.defaultLocale]?.title ?? `Draft #${draft.id}`,
  });

  useDraftWatch(initial.id, initial.revision, (event) => {
    if (event.type === "discarded") {
      toast.info("This draft was discarded elsewhere.");
      router.replace("/feed/drafts");
    } else if (event.type === "applied" || event.type === "revision") {
      const cached = queryClient.getQueryData(
        orpc.feeds["draft:get"].queryOptions({ input: { draftId: initial.id } })
          .queryKey
      );
      if (
        event.type === "revision" &&
        event.revision <= (cached?.revision ?? 0)
      )
        return;
      void queryClient.invalidateQueries({
        queryKey: orpc.feeds["draft:get"].key({
          input: { draftId: initial.id },
        }),
      });
    }
  });

  const conflict =
    autosave.issue?.kind === "conflict" ? autosave.issue.draft : null;
  const remoteChanged = draft.revision > autosave.saved.revision;
  const status = autosave.issue ? (
    <span className="text-danger text-sm" role="alert">
      {autosave.issue.kind === "conflict"
        ? "Resolve the conflict to continue"
        : autosave.issue.message}
    </span>
  ) : autosave.isSaving ? (
    <span className="text-muted flex items-center gap-2 text-xs">
      <Spinner size="sm" />
      Saving draft…
    </span>
  ) : autosave.isDirty ? (
    <span className="text-muted text-xs">
      Unsaved changes · autosaves after typing
    </span>
  ) : (
    <span className="text-muted text-xs">
      Saved · {dayjs(autosave.saved.updatedAt).format("HH:mm:ss")}
    </span>
  );

  return (
    <FormProvider {...form}>
      <Form
        onSubmit={(event) => {
          event.preventDefault();
          void autosave.retry();
        }}
        className="flex w-full flex-col gap-6">
        <DraftActions
          draft={draft}
          hasLocalChanges={autosave.isDirty}
          isSaveBlocked={autosave.issue !== null}
          beforeAction={autosave.flush}
          onDraftChanged={autosave.adopt}
          status={
            <div className="flex flex-wrap items-center gap-2" role="status">
              {status}
              {remoteChanged && !conflict ? (
                <Chip color="warning" size="sm" variant="soft">
                  <Chip.Label>Changed elsewhere</Chip.Label>
                </Chip>
              ) : null}
              {autosave.issue?.kind === "error" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onPress={() => void autosave.retry()}>
                  Retry save
                </Button>
              ) : null}
            </div>
          }>
          <EditFields feedId={draft.feedId ?? undefined} />
        </DraftActions>
      </Form>
      <AlertDialog isOpen={conflict !== null}>
        <AlertDialog.Backdrop isKeyboardDismissDisabled>
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
                  Revision {conflict?.revision} contains newer changes. Keep
                  your edited fields over that version, or replace your local
                  edits with the latest draft.
                </p>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button
                  onPress={() => {
                    if (conflict) autosave.adopt(conflict);
                  }}
                  variant="tertiary">
                  Load latest draft
                </Button>
                <Button
                  onPress={() => void autosave.keepMine()}
                  variant="primary">
                  Keep my edits
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
