import type { AgentKindDefinition } from "@chia/agent-host/kind";
import { assertWithinAgentQuota } from "@chia/agent-host/quota";
import { AGENT_TASK_IDS, resolveAgentTask } from "@chia/agent-host/tasks";
import { recordAgentUsage } from "@chia/agent-host/usage";
import { createAgentModels } from "@chia/agent-runtime/models";
import { canCompactBranch } from "@chia/agent-runtime/pi/compaction";
import {
  compactPiSession,
  navigatePiSession,
} from "@chia/agent-runtime/pi/maintenance";
import type { SessionEntry } from "@chia/agent-runtime/session/entries";
import type { SessionTree } from "@chia/agent-runtime/session/tree";
import type {
  AgentNavigationOptions,
  AgentUsageListener,
} from "@chia/agent-runtime/types";
import type {
  AgentKindService,
  AgentServiceCaller,
} from "@chia/api/orpc/services/agent.service";
import type { DB } from "@chia/db/client";
import { deleteAgentSession, withAgentSessionLock } from "@chia/db/repos/agent";
import { AppError } from "@chia/service-kit/errors";

import {
  decryptAgentCredentials,
  readEncryptedAgentCredentials,
} from "../../services/agent-credentials.service";
import { runStateOf } from "../../services/agent-run-liveness.service";

import type { AgentSessionOperations } from "./session";

type MaintenanceService = Pick<
  AgentKindService,
  "compact" | "navigate" | "fork"
>;

type OwnedSession<TState, TConfig extends object> = NonNullable<
  Awaited<
    ReturnType<AgentSessionOperations<TState, TConfig>["loadOwnedSession"]>
  >
>;

const MAINTENANCE_DEADLINE_MS = 120_000;

const maintenanceTimedOut = (action: string) =>
  new AppError("TIMEOUT", {
    message: `Could not ${action} within ${MAINTENANCE_DEADLINE_MS / 1000}s. The conversation is unchanged.`,
  });

const nothingToCompact = () =>
  new AppError("CONFLICT", {
    message:
      "Nothing to compact: the conversation still fits in what a compaction keeps.",
  });

/** Compaction, branch navigation and forks for one agent kind. */
export const createAgentMaintenanceOperations = <
  TState,
  TConfig extends object,
>(
  definition: AgentKindDefinition<TState, TConfig>,
  sessions: AgentSessionOperations<TState, TConfig>
): MaintenanceService => {
  const assertMaintainable = async (
    row: OwnedSession<TState, TConfig>,
    db: DB,
    action: string
  ): Promise<void> => {
    if ((await runStateOf(row))?.status === "running") {
      throw new AppError("CONFLICT", {
        message: `Cannot ${action} while a turn is running. Wait for it to finish or abort it.`,
      });
    }
    const outstanding = await sessions.undecidedApprovals(db, row.id);
    if (outstanding.length > 0) {
      throw new AppError("CONFLICT", {
        message: `Cannot ${action} while \`${outstanding.join("`, `")}\` awaits your decision. Approve or reject it first.`,
      });
    }
  };

  /** Centralizes the lock, transaction caller, ownership and mutation guard. */
  const withMaintainableSession = <T>(
    outer: AgentServiceCaller,
    sessionId: string,
    action: string,
    operation: (
      caller: AgentServiceCaller,
      row: OwnedSession<TState, TConfig>,
      db: DB
    ) => Promise<T>
  ): Promise<T | null> =>
    withAgentSessionLock(outer.context.db, sessionId, async (tx) => {
      const caller = sessions.withDb(outer, tx);
      const row = await sessions.loadOwnedSession(caller, sessionId);
      if (!row) return null;
      await assertMaintainable(row, tx, action);
      return operation(caller, row, tx);
    });

  const requireEntry = async (
    session: SessionTree,
    entryId: string
  ): Promise<SessionEntry> => {
    const entry = await session.getEntry(entryId);
    if (!entry) {
      throw new AppError("NOT_FOUND", {
        message: `Entry ${entryId} is not in this session.`,
      });
    }
    return entry;
  };

  /** Builds only the model and session dependencies a tree mutation needs. */
  const maintenanceFor = async (
    caller: AgentServiceCaller,
    row: OwnedSession<TState, TConfig>,
    signal: AbortSignal
  ) => {
    const db = caller.context.db;
    const session = await sessions.repoFor(db).openById(row.id);
    const settings = sessions.settingsOf(row);
    const models = createAgentModels(
      decryptAgentCredentials(
        readEncryptedAgentCredentials(caller.context.headers)
      )
    );
    const onUsage: AgentUsageListener = (report) =>
      recordAgentUsage(db, {
        userId: caller.userId,
        sessionId: row.id,
        kind: definition.kind,
        ...report,
      });
    const operationFor = async (taskId: string) => {
      const task = await resolveAgentTask(db, taskId, {
        session: () => ({
          model: definition.models.resolve(settings, models),
          models,
        }),
      });
      return {
        session,
        settings,
        model: task.model,
        models: task.models,
        signal,
        onUsage,
      };
    };
    return {
      session,
      compact: async (customInstructions?: string) =>
        compactPiSession(
          await operationFor(AGENT_TASK_IDS.sessionCompaction),
          customInstructions
        ),
      navigate: async (entryId: string, options: AgentNavigationOptions) =>
        navigatePiSession(
          await operationFor(AGENT_TASK_IDS.sessionBranchSummary),
          entryId,
          options
        ),
    };
  };

  return {
    compact: (outer, input) =>
      withMaintainableSession(
        outer,
        input.sessionId,
        "compact",
        async (caller, row, db) => {
          const deadline = AbortSignal.timeout(MAINTENANCE_DEADLINE_MS);
          const maintenance = await maintenanceFor(caller, row, deadline);
          if (!canCompactBranch(await maintenance.session.getBranch())) {
            throw nothingToCompact();
          }
          await assertWithinAgentQuota(db, caller);

          let compacted: Awaited<ReturnType<typeof maintenance.compact>>;
          try {
            compacted = await maintenance.compact(input.customInstructions);
          } catch (error) {
            if (deadline.aborted) throw maintenanceTimedOut("compact");
            throw error;
          }
          if (!compacted) throw nothingToCompact();
          return sessions.detailFor(caller, input.sessionId);
        }
      ),

    navigate: (outer, input) =>
      withMaintainableSession(
        outer,
        input.sessionId,
        "rewind",
        async (caller, row, db) => {
          if (input.summarize) await assertWithinAgentQuota(db, caller);

          const deadline = AbortSignal.timeout(MAINTENANCE_DEADLINE_MS);
          const maintenance = await maintenanceFor(caller, row, deadline);
          await requireEntry(maintenance.session, input.entryId);
          const result = await maintenance.navigate(input.entryId, {
            summarize: input.summarize,
            label: input.label,
          });
          if (result.cancelled) throw maintenanceTimedOut("rewind");
          return sessions.detailFor(caller, input.sessionId);
        }
      ),

    fork: (outer, input) =>
      withMaintainableSession(
        outer,
        input.sessionId,
        "fork",
        async (caller, row, db) => {
          const repo = sessions.repoFor(db);
          const position = input.position ?? "before";
          if (input.entryId) {
            const target = await requireEntry(
              await repo.openById(row.id),
              input.entryId
            );
            if (
              position === "before" &&
              (target.type !== "message" || target.message.role !== "user")
            ) {
              throw new AppError("BAD_REQUEST", {
                message:
                  "Only a user message can be forked before; fork at this entry instead.",
              });
            }
          }

          const forked = await repo.fork(
            { id: row.id },
            { entryId: input.entryId, position, title: input.title }
          );
          try {
            await definition.state.fork(db, row.id, forked.id);
            const detail = await sessions.detailFor(caller, forked.id);
            if (!detail)
              throw new Error("Session vanished immediately after fork");
            return detail;
          } catch (error) {
            await deleteAgentSession(db, forked.id);
            throw error;
          }
        }
      ),
  };
};
