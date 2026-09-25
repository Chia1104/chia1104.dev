import { loadKindConfig } from "@chia/agent-host/config";
import type { AgentKindDefinition } from "@chia/agent-host/kind";
import { assertWithinAgentQuota } from "@chia/agent-host/quota";
import { AgentTaskId, resolveAgentTask } from "@chia/agent-host/tasks";
import { sessionUsageListener } from "@chia/agent-host/usage";
import {
  canCompactBranch,
  compactSession,
} from "@chia/agent-runtime/compaction";
import { navigateSession } from "@chia/agent-runtime/maintenance";
import {
  accessOf,
  bindModel,
  loadAgentCatalog,
} from "@chia/agent-runtime/models";
import type { SessionEntry } from "@chia/agent-runtime/session/entries";
import { settingsFromRow } from "@chia/agent-runtime/session/pg-repo";
import type { SessionTree } from "@chia/agent-runtime/session/tree";
import type { AgentNavigationOptions } from "@chia/agent-runtime/types";
import type { DB } from "@chia/db/client";
import { deleteAgentSession, withAgentSessionLock } from "@chia/db/repos/agent";
import { AppError, AppErrorCode } from "@chia/service-kit/errors";

import { AgentRunState } from "./agent.contract";
import type { AgentServiceHost } from "./agent.factory";
import type { AgentKindService, AgentServiceCaller } from "./agent.service";
import { runStateOf } from "./run-liveness";
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

const maintenanceTimedOut = (action: string, cause?: unknown) =>
  new AppError(AppErrorCode.Timeout, {
    message: `Could not ${action} within ${MAINTENANCE_DEADLINE_MS / 1000}s. The conversation is unchanged.`,
    cause,
  });

const nothingToCompact = () =>
  new AppError(AppErrorCode.Conflict, {
    message:
      "Nothing to compact: the conversation still fits in what a compaction keeps.",
  });

/** Compaction, branch navigation and forks for one agent kind. */
export const createAgentMaintenanceOperations = <
  TState,
  TConfig extends object,
>(
  definition: AgentKindDefinition<TState, TConfig>,
  sessions: AgentSessionOperations<TState, TConfig>,
  host: AgentServiceHost
): MaintenanceService => {
  const assertMaintainable = async (
    row: OwnedSession<TState, TConfig>,
    db: DB,
    action: string
  ): Promise<void> => {
    if ((await runStateOf(host.runs, row))?.status === AgentRunState.Running) {
      throw new AppError(AppErrorCode.Conflict, {
        message: `Cannot ${action} while a turn is running. Wait for it to finish or abort it.`,
      });
    }
    const outstanding = await sessions.undecidedApprovals(db, row.id);
    if (outstanding.length > 0) {
      throw new AppError(AppErrorCode.Conflict, {
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
      throw new AppError(AppErrorCode.NotFound, {
        message: `Entry ${entryId} is not in this session.`,
      });
    }
    return entry;
  };

  /**
   * Builds only the model and session dependencies a tree mutation needs. `ledger` is a
   * connection outside the lock transaction: a model call that is then rolled back was still
   * billed, so its usage row must survive the rollback.
   */
  const maintenanceFor = async (
    caller: AgentServiceCaller,
    ledger: DB,
    row: OwnedSession<TState, TConfig>,
    signal: AbortSignal
  ) => {
    const db = caller.context.db;
    const session = sessions.repoFor(db).open(row);
    const { defaults: house } = await loadKindConfig(db, definition);
    const settings = settingsFromRow(row, house);
    const credentials = host.credentials.decrypt(
      host.credentials.read(caller.context.headers)
    );
    const access = accessOf(credentials);
    const catalog = await loadAgentCatalog();
    const operationFor = async (taskId: string) => {
      const task = await resolveAgentTask(db, taskId, {
        catalog,
        session: () => ({
          binding: bindModel(
            definition.models.resolve(settings, catalog, access, house),
            credentials,
            settings.thinkingLevel
          ),
          credentials,
        }),
      });
      return {
        session,
        binding: task.binding,
        signal,
        onUsage: sessionUsageListener(ledger, {
          userId: caller.userId,
          sessionId: row.id,
          kind: definition.kind,
          credentialsFor: () => task.credentials,
        }),
      };
    };
    return {
      session,
      compact: async (customInstructions?: string) =>
        compactSession({
          ...(await operationFor(AgentTaskId.SessionCompaction)),
          customInstructions,
        }),
      navigate: async (entryId: string, options: AgentNavigationOptions) =>
        navigateSession(
          await operationFor(AgentTaskId.SessionBranchSummary),
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
          const maintenance = await maintenanceFor(
            caller,
            outer.context.db,
            row,
            deadline
          );
          if (!canCompactBranch(await maintenance.session.getBranch())) {
            throw nothingToCompact();
          }
          await assertWithinAgentQuota(db, caller);

          let compacted: Awaited<ReturnType<typeof maintenance.compact>>;
          try {
            compacted = await maintenance.compact(input.customInstructions);
          } catch (error) {
            if (deadline.aborted) throw maintenanceTimedOut("compact", error);
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
          const maintenance = await maintenanceFor(
            caller,
            outer.context.db,
            row,
            deadline
          );
          await requireEntry(maintenance.session, input.entryId);
          const result = await maintenance.navigate(input.entryId, {
            summarize: input.summarize,
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
            const target = await requireEntry(repo.open(row), input.entryId);
            if (
              position === "before" &&
              (target.type !== "message" || target.message.role !== "user")
            ) {
              throw new AppError(AppErrorCode.BadRequest, {
                message:
                  "Only a user message can be forked before; fork at this entry instead.",
              });
            }
          }

          const forked = await repo.fork(row, {
            entryId: input.entryId,
            position,
            title: input.title,
          });
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
