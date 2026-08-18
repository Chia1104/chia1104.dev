/**
 * The turns executing in this process, keyed by workflow run id, so an operator's abort can reach
 * the harness directly.
 *
 * Nothing in the workflow SDK signals a step already in flight — cancelling the run only stops it
 * from being scheduled again — and the turn step and the request that aborts it share one process
 * (`infra/railway/service.json` runs a single replica; the workflow world executes steps in-process).
 * A registry is therefore the whole mechanism: no timer, no row to poll, no second channel. If the
 * service ever runs more than one replica, `abortRunningTurn` needs a broadcast to reach the replica
 * that holds the turn; the postgres workflow world already uses `LISTEN`/`NOTIFY` for its streams,
 * which is the shape that fits.
 */
const running = new Map<string, AbortController>();

/** Registers a turn; the returned controller's signal aborts it. Unregister when the turn ends. */
export const registerRunningTurn = (
  workflowRunId: string
): { signal: AbortSignal; unregister: () => void } => {
  const controller = new AbortController();
  running.set(workflowRunId, controller);
  return {
    signal: controller.signal,
    unregister: () => {
      if (running.get(workflowRunId) === controller)
        running.delete(workflowRunId);
    },
  };
};

/** Aborts the turn this process is executing for the run, if any. */
export const abortRunningTurn = (workflowRunId: string): boolean => {
  const controller = running.get(workflowRunId);
  if (!controller) return false;
  controller.abort();
  return true;
};
