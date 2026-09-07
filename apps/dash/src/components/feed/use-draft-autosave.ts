"use client";

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";

import { ORPCError } from "@orpc/client";
import { useDebouncer } from "@tanstack/react-pacer";
import { useMutation } from "@tanstack/react-query";
import { useWatch } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";

import { orpc } from "@/libs/orpc/client";

import type { DraftFormValues } from "./draft-form-schema";
import { draftSnapshotStore, readDraftSnapshot } from "./draft-snapshot";
import { applyPatch, diffValues, toValues } from "./draft-values";
import type { DraftView } from "./draft-values";

const AUTOSAVE_WAIT_MS = 3000;
/** Continuous typing still reaches the server this often. */
const AUTOSAVE_MAX_WAIT_MS = 15_000;

export const useDraftAutosave = ({
  initial,
  form,
  onSaved,
  loadLatest,
}: {
  initial: DraftView;
  form: UseFormReturn<DraftFormValues>;
  onSaved: (draft: DraftView) => void;
  loadLatest: () => Promise<DraftView>;
}) => {
  const [saved, setSaved] = useState(initial);
  const [issue, setIssue] = useState<
    | { kind: "conflict"; draft: DraftView }
    | { kind: "error"; message: string }
    | null
  >(null);
  // Async callers share the acknowledged revision before React commits the next render.
  const baseline = useRef(initial);
  const blocked = useRef(false);
  const pending = useRef<Promise<boolean> | null>(null);
  const kept = useRef(false);
  const { mutateAsync, isPending } = useMutation(
    orpc.feeds["draft:patch"].mutationOptions()
  );
  const [slug, type, defaultLocale, mainImage, translations] = useWatch({
    control: form.control,
    name: ["slug", "type", "defaultLocale", "mainImage", "translations"],
  });
  const patch = diffValues(
    { slug, type, defaultLocale, mainImage, translations },
    toValues(saved)
  );
  const changes = JSON.stringify(patch);
  const isDirty = patch !== null;
  const paused = issue !== null;

  const acknowledge = useCallback(
    (next: DraftView) => {
      baseline.current = next;
      setSaved(next);
      onSaved(next);
    },
    [onSaved]
  );

  const adopt = useCallback(
    (next: DraftView) => {
      form.reset({
        ...toValues(next),
        activeLocale: form.getValues("activeLocale"),
      });
      blocked.current = false;
      setIssue(null);
      acknowledge(next);
    },
    [acknowledge, form]
  );

  const flush = useCallback((): Promise<boolean> => {
    if (pending.current) return pending.current;
    if (blocked.current) return Promise.resolve(false);
    const save = async () => {
      try {
        let delta = diffValues(form.getValues(), toValues(baseline.current));
        while (delta) {
          const next = await mutateAsync({
            draftId: initial.id,
            expectedRevision: baseline.current.revision,
            ...delta,
          });
          acknowledge(next);
          // Edits made during a request must finish saving before Apply can proceed.
          delta = diffValues(form.getValues(), toValues(next));
        }
        setIssue(null);
        return true;
      } catch (error) {
        blocked.current = true;
        if (error instanceof ORPCError && error.code === "CONFLICT") {
          try {
            setIssue({ kind: "conflict", draft: await loadLatest() });
          } catch (loadError) {
            setIssue({
              kind: "error",
              message:
                loadError instanceof Error
                  ? loadError.message
                  : "Could not load the latest draft. Retry saving to resolve the conflict.",
            });
          }
        } else {
          setIssue({
            kind: "error",
            message: error instanceof Error ? error.message : "Save failed",
          });
        }
        return false;
      } finally {
        pending.current = null;
      }
    };
    // Defer execution until the shared promise is assigned, including the no-change path.
    pending.current = Promise.resolve().then(save);
    return pending.current;
  }, [acknowledge, form, initial.id, loadLatest, mutateAsync]);

  // Every edit restarts the wait; a form back at its saved state drops the pending save.
  const scheduled = useDebouncer(() => void flush(), {
    wait: AUTOSAVE_WAIT_MS,
  });
  useEffect(() => {
    if (isDirty && !paused) scheduled.maybeExecute();
    else scheduled.cancel();
  }, [changes, isDirty, paused, scheduled]);

  useEffect(() => {
    if (!isDirty || paused) return;
    const timer = setTimeout(() => void flush(), AUTOSAVE_MAX_WAIT_MS);
    return () => clearTimeout(timer);
  }, [flush, isDirty, paused]);

  // Leaving the tab saves at once; the request may not finish, and the snapshot below covers that.
  const flushNow = useEffectEvent(() => {
    if (
      blocked.current ||
      !diffValues(form.getValues(), toValues(baseline.current))
    )
      return;
    scheduled.cancel();
    void flush();
  });
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushNow();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", flushNow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", flushNow);
    };
  }, []);

  // Only this tab's own transition back to clean drops the snapshot; another tab may be mid-edit.
  const persist = useEffectEvent(() => {
    const { keep, drop } = draftSnapshotStore.getState();
    if (patch) {
      keep(initial.id, { revision: saved.revision, patch });
      kept.current = true;
    } else if (kept.current) {
      drop(initial.id);
      kept.current = false;
    }
  });
  useEffect(() => persist(), [changes]);

  // Edits made against the current revision resume; edits against an older one are a conflict.
  const restore = useEffectEvent(() => {
    const snapshot = readDraftSnapshot(initial.id);
    if (!snapshot) return;
    const activeLocale = form.getValues("activeLocale");
    if (snapshot.revision === initial.revision) {
      form.reset({
        ...applyPatch(toValues(initial), snapshot.patch),
        activeLocale,
      });
      void flush();
      return;
    }
    draftSnapshotStore.getState().drop(initial.id);
    if (snapshot.revision < initial.revision) {
      form.reset({
        ...applyPatch(toValues(initial), snapshot.patch),
        activeLocale,
      });
      blocked.current = true;
      setIssue({ kind: "conflict", draft: initial });
    }
  });
  useEffect(() => restore(), []);

  const receive = useCallback(
    (next: DraftView) => {
      if (
        next.revision <= baseline.current.revision ||
        blocked.current ||
        pending.current
      )
        return;
      if (diffValues(form.getValues(), toValues(baseline.current))) return;
      adopt(next);
    },
    [adopt, form]
  );

  const retry = () => {
    if (issue?.kind === "conflict") return Promise.resolve(false);
    blocked.current = false;
    return flush();
  };

  const keepMine = async () => {
    if (issue?.kind !== "conflict") return;
    const mine = diffValues(form.getValues(), toValues(baseline.current));
    const next = issue.draft;
    adopt(next);
    if (mine) {
      form.reset({
        ...applyPatch(toValues(next), mine),
        activeLocale: form.getValues("activeLocale"),
      });
      await flush();
    }
  };

  return {
    saved,
    issue,
    isDirty,
    isSaving: isPending,
    isSynced: !isDirty && !isPending && !paused,
    flush,
    retry,
    adopt,
    receive,
    keepMine,
  };
};
