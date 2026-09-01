"use client";

import { useEffect, useRef } from "react";

import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/libs/orpc/client";
import type { RouterOutputs } from "@/libs/orpc/types";

import type { RunStatus } from "./rag-shared";

export type IndexRun = RouterOutputs["rag"]["run:get"]["run"];

const TERMINAL_STATUSES: RunStatus[] = ["completed", "failed", "cancelled"];

export const isTerminalRunStatus = (
  status: RunStatus | undefined
): status is RunStatus => !!status && TERMINAL_STATUSES.includes(status);

const POLL_INTERVAL_MS = 2000;

/**
 * Follows one index run until it stops. `run:get` is the only route that reconciles against
 * the workflow runtime, so this status is trusted over `activeRunId` from a read route.
 */
export const useIndexRun = ({
  runId,
  onSettled,
}: {
  runId: string | null;
  onSettled?: (run: IndexRun) => void;
}) => {
  const query = useQuery(
    orpc.rag["run:get"].queryOptions({
      input: { runId: runId ?? "" },
      enabled: !!runId,
      refetchInterval: ({ state }) =>
        isTerminalRunStatus(state.data?.run.status) ? false : POLL_INTERVAL_MS,
    })
  );

  const run = query.data?.run;
  // one notification per run, even though `onSettled` may be a fresh closure each render
  const settledRunId = useRef<string | null>(null);

  useEffect(() => {
    if (!run || !isTerminalRunStatus(run.status)) return;
    if (settledRunId.current === run.runId) return;
    settledRunId.current = run.runId;
    onSettled?.(run);
  }, [run, onSettled]);

  return {
    run,
    isLoading: query.isLoading,
    error: query.error,
    /** A failed poll counts as not active, otherwise a missing run would leave every trigger disabled. */
    isActive: !!runId && !query.isError && !isTerminalRunStatus(run?.status),
  };
};
