import "zod/compile";
import { FatalError } from "workflow";

import { AGENT_TASK_IDS, resolveAgentTask } from "@chia/agent-host/tasks";
import { recordAgentUsage } from "@chia/agent-host/usage";
import { WRITING_AGENT_KIND } from "@chia/agent-writing/models";
import {
  createMemoryService,
  reinforceLessonService,
} from "@chia/api/memories/write";
import { connectDatabase } from "@chia/db/client";
import {
  getAgentSession,
  getWritingAgentSession,
  getWritingSessionConsolidation,
  updateWritingSessionConsolidation,
} from "@chia/db/repos/agent";
import { listAgentLessons } from "@chia/db/repos/agent/memory";
import { listFeedDraftRevisionsSince } from "@chia/db/repos/drafts";
import { AGENT_MEMORY_KIND, AGENT_MEMORY_STATUS } from "@chia/db/schema";

import { memoryHooks } from "../services/agent-memory-indexing.service";

const LESSON_TIMEOUT_MS = 60_000;
/** Lessons the model is shown per status; the prompt clips each active one's content. */
const LESSONS_SHOWN_MAX = 50;

export interface MemoryConsolidationResult {
  status: "extracted" | "nothing" | "unavailable";
  created: number[];
  reinforced: number;
}

/**
 * Writes what the operator taught since the last run as `pending` lessons, and counts repeats
 * of lessons still awaiting review. Reads the transcript after the session's watermark and
 * the operator's draft edits since it, so every run costs one bounded model call and a
 * correction is read once. Only operator messages, assistant prose and the operator's own
 * edits reach the model.
 * A model failure is `nothing` and leaves the watermark, so the next run reads the same delta.
 * Runtime is imported at first use: this step is registered at boot and the runtime carries
 * the provider stack.
 */
export const consolidateSessionMemoryStep = async (request: {
  sessionId: string;
}): Promise<MemoryConsolidationResult> => {
  "use step";

  const db = await connectDatabase(undefined, { withCache: false });

  const row = await getAgentSession(db, request.sessionId);
  if (!row || row.deletedAt !== null) {
    throw new FatalError(`Unknown agent session: ${request.sessionId}`);
  }
  if (row.kind !== WRITING_AGENT_KIND) {
    throw new FatalError(
      `Session ${request.sessionId} is a ${row.kind} session; only writing sessions are consolidated.`
    );
  }

  const [
    { completeText },
    { PgSessionRepo },
    {
      branchSince,
      buildLessonExtractionPrompt,
      collectOperatorEdits,
      collectOperatorExchange,
      parseLessonProposals,
      wholeBranch,
    },
    { WRITING_SESSION_DEFAULTS },
  ] = await Promise.all([
    import("@chia/agent-runtime/pi/complete"),
    import("@chia/agent-runtime/session/pg-repo"),
    import("@chia/agent-writing/memory/lessons"),
    import("@chia/agent-writing/models"),
  ]);

  /**
   * `writing.lessons` task: house cheap model, never the session's (may be BYOK).
   * Resolved before the transcript so an unavailable model costs nothing.
   */
  let task: Awaited<ReturnType<typeof resolveAgentTask>>;
  try {
    task = await resolveAgentTask(db, AGENT_TASK_IDS.writingLessons);
  } catch {
    return { status: "unavailable", created: [], reinforced: 0 };
  }

  const startedAt = new Date();
  const [mark, state] = await Promise.all([
    getWritingSessionConsolidation(db, request.sessionId),
    getWritingAgentSession(db, request.sessionId),
  ]);

  const repo = new PgSessionRepo(db, {
    kind: WRITING_AGENT_KIND,
    defaults: WRITING_SESSION_DEFAULTS,
  });
  const session = await repo.openById(request.sessionId);
  const [entries, leafId] = await Promise.all([
    session.getEntries(),
    session.getLeafId(),
  ]);
  const exchange = collectOperatorExchange(
    branchSince(wholeBranch(entries, leafId), mark?.consolidatedLeafId ?? null)
  );

  const edits = [];
  for (const draft of state?.drafts ?? []) {
    const revisions = await listFeedDraftRevisionsSince(db, {
      draftId: draft.draftId,
      userId: row.userId,
      after: mark?.consolidatedAt ?? null,
    });
    edits.push({
      draftId: draft.draftId,
      edits: collectOperatorEdits(revisions),
    });
  }

  const [active, pending] = await Promise.all([
    listAgentLessons(db, {
      status: AGENT_MEMORY_STATUS.Active,
      limit: LESSONS_SHOWN_MAX,
    }),
    listAgentLessons(db, {
      status: AGENT_MEMORY_STATUS.Pending,
      limit: LESSONS_SHOWN_MAX,
    }),
  ]);
  const markConsolidated = () =>
    updateWritingSessionConsolidation(db, request.sessionId, {
      consolidatedLeafId: leafId,
      consolidatedAt: startedAt,
    });

  const prompt = buildLessonExtractionPrompt({
    exchange,
    edits,
    activeLessons: active,
    pendingLessons: pending,
    systemPrompt: task.systemPrompt,
  });
  if (!prompt) {
    await markConsolidated();
    return { status: "nothing", created: [], reinforced: 0 };
  }

  const reply = await completeText({
    models: task.models,
    model: task.model,
    systemPrompt: prompt.systemPrompt,
    text: prompt.text,
    ...task.params,
    signal: AbortSignal.timeout(LESSON_TIMEOUT_MS),
    // The house pays, the session's owner is who it was for.
    onUsage: (usage) =>
      recordAgentUsage(db, {
        userId: row.userId,
        sessionId: row.id,
        kind: row.kind,
        source: "lessons",
        credentialSource: "house",
        ...usage,
      }),
  });
  if (!reply) {
    return { status: "nothing", created: [], reinforced: 0 };
  }

  const activeIds = new Set(active.map((lesson) => lesson.id));
  const pendingById = new Map(pending.map((lesson) => [lesson.id, lesson]));
  const created: number[] = [];
  let reinforced = 0;
  for (const proposal of parseLessonProposals(reply)) {
    if (proposal.action === "reinforce") {
      // a session does not vouch for its own proposal
      const target = pendingById.get(proposal.id);
      if (!target || target.sessionId === request.sessionId) continue;
      if (await reinforceLessonService(db, { id: proposal.id })) reinforced++;
      continue;
    }
    if (proposal.action === "revise" && !activeIds.has(proposal.id)) continue;
    const saved = await createMemoryService(
      db,
      {
        kind: AGENT_MEMORY_KIND.Lesson,
        status: AGENT_MEMORY_STATUS.Pending,
        title: proposal.title,
        content: proposal.content,
        sessionId: request.sessionId,
        supersedesId: proposal.action === "revise" ? proposal.id : null,
      },
      memoryHooks
    );
    created.push(saved.id);
  }
  await markConsolidated();

  return {
    status: created.length > 0 || reinforced > 0 ? "extracted" : "nothing",
    created,
    reinforced,
  };
};

/**
 * A retry after a partial write would insert the same lessons again.
 */
consolidateSessionMemoryStep.maxRetries = 0;
