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
import {
  applyPatch,
  diffValues,
  rebaseValues,
  seenOf,
  toValues,
  toWrite,
} from "./draft-values";
import type { DraftValues, DraftView } from "./draft-values";

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

  // A copy: the form hands out its live values, and what a request sent must not move under it.
  const localValues = useCallback((): DraftValues => {
    const { activeLocale: _activeLocale, ...values } = form.getValues();
    return structuredClone(values);
  }, [form]);

  /**
   * Carries the local edits, made against `base`, onto `next` and takes `next` as the new
   * baseline. Answers false, and pauses saving, when a field both sides changed is left.
   */
  const carry = useCallback(
    (next: DraftView, base: DraftValues, acknowledged: boolean): boolean => {
      const local = localValues();
      const { values, conflicts } = rebaseValues({
        base,
        local,
        next: toValues(next),
        acknowledged,
      });
      if (diffValues(values, local)) {
        form.reset({
          ...values,
          activeLocale: form.getValues("activeLocale"),
        });
      }
      acknowledge(next);
      if (conflicts.length === 0) return true;
      blocked.current = true;
      setIssue({ kind: "conflict", draft: next });
      return false;
    },
    [acknowledge, form, localValues]
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
        for (;;) {
          const sent = localValues();
          const write = toWrite(sent, toValues(baseline.current));
          // Edits made during a request must finish saving before Apply can proceed.
          if (!write) break;
          let next: DraftView;
          try {
            next = await mutateAsync({ draftId: initial.id, ...write });
          } catch (error) {
            if (!(error instanceof ORPCError && error.code === "CONFLICT")) {
              throw error;
            }
            // A field moved under the write: carry the edits onto what the draft holds now
            // and send again. A draft that did not move would reject the same write forever.
            const latest = await loadLatest();
            if (latest.revision <= baseline.current.revision) throw error;
            if (!carry(latest, toValues(baseline.current), false)) return false;
            continue;
          }
          if (!carry(next, sent, true)) return false;
        }
        setIssue(null);
        return true;
      } catch (error) {
        blocked.current = true;
        setIssue({
          kind: "error",
          message: error instanceof Error ? error.message : "Save failed",
        });
        return false;
      } finally {
        pending.current = null;
      }
    };
    // Defer execution until the shared promise is assigned, including the no-change path.
    pending.current = Promise.resolve().then(save);
    return pending.current;
  }, [carry, initial.id, loadLatest, localValues, mutateAsync]);

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
    // An unresolved conflict already took the remote draft as its baseline. Writing the snapshot
    // now would record that as what the edits replaced, and the next reload would find nothing
    // to ask about and save over the remote change. The dialog is modal, so nothing new is typed.
    if (issue?.kind === "conflict") return;
    const { keep, drop } = draftSnapshotStore.getState();
    if (patch) {
      keep(initial.id, { patch, seen: seenOf(patch, toValues(saved)) });
      kept.current = true;
    } else if (kept.current) {
      drop(initial.id);
      kept.current = false;
    }
  });
  useEffect(() => persist(), [changes]);

  // Edits kept in this browser come back carried onto what the draft holds now; only a field
  // that moved on both sides is left for the operator.
  const restore = useEffectEvent(() => {
    const snapshot = readDraftSnapshot(initial.id);
    if (!snapshot) return;
    // This tab owns the snapshot from here, so it is the one to drop it once the edits are saved.
    kept.current = true;
    const current = toValues(initial);
    const { values, conflicts } = rebaseValues({
      base: applyPatch(current, snapshot.seen),
      local: applyPatch(current, snapshot.patch),
      next: current,
    });
    form.reset({ ...values, activeLocale: form.getValues("activeLocale") });
    if (conflicts.length === 0) {
      void flush();
      return;
    }
    blocked.current = true;
    setIssue({ kind: "conflict", draft: initial });
  });
  useEffect(() => restore(), []);

  /** A newer draft from the watch or a refetch: local edits are carried onto it rather than holding it back. */
  const receive = useCallback(
    (next: DraftView) => {
      if (
        next.revision <= baseline.current.revision ||
        blocked.current ||
        pending.current
      )
        return;
      carry(next, toValues(baseline.current), false);
    },
    [carry]
  );

  /** Saves pending edits, then answers the draft as the server acknowledged it; `null` while saving is blocked. */
  const settle = useCallback(
    async () => ((await flush()) ? baseline.current : null),
    [flush]
  );

  const retry = () => {
    if (issue?.kind === "conflict") return Promise.resolve(false);
    blocked.current = false;
    return flush();
  };

  /** Writes the local values over the draft the conflict was found against. */
  const keepMine = async () => {
    if (issue?.kind !== "conflict") return;
    blocked.current = false;
    setIssue(null);
    acknowledge(issue.draft);
    await flush();
  };

  return {
    saved,
    issue,
    isDirty,
    isSaving: isPending,
    isSynced: !isDirty && !isPending && !paused,
    flush,
    settle,
    retry,
    adopt,
    receive,
    keepMine,
  };
};
