import { FatalError } from "workflow";

import { AGENT_TASK_IDS, resolveAgentTask } from "@chia/agent-host/tasks";
import { WRITING_AGENT_KIND } from "@chia/agent-writing/models";
import { createMemoryService } from "@chia/api/memories/write";
import { connectDatabase } from "@chia/db/client";
import { getAgentSession } from "@chia/db/repos/agent";
import { listAgentMemories } from "@chia/db/repos/agent/memory";
import { AGENT_MEMORY_KIND, AGENT_MEMORY_STATUS } from "@chia/db/schema";

import { memoryHooks } from "../services/agent-memory-indexing.service";

const LESSON_TIMEOUT_MS = 60_000;
/** Titles the model is told not to repeat; the digest itself is capped far lower. */
const EXISTING_LESSONS_MAX = 100;

export interface MemoryConsolidationResult {
  status: "extracted" | "nothing" | "unavailable";
  /** Ids of the pending lessons written. */
  created: number[];
}

/**
 * Reads one session's transcript and writes what the operator taught the agent as
 * `pending` lessons.
 *
 * Reads only: no session lock, no `Agent`. The branch is walked from the raw entries so
 * compaction cannot hide the operator's earlier corrections, and only their messages and
 * the assistant's prose reach the model — never a tool result.
 *
 * A model failure is "nothing", not an error: a lesson is a gain, and a step that retried
 * until it produced one would eventually insert the same lessons twice.
 *
 * The runtime is imported at first use rather than at module scope, as in `agent-turn.step.ts`:
 * this step is registered at boot for every process that hosts the workflow, and the runtime
 * carries the provider stack.
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
      buildLessonExtractionPrompt,
      collectOperatorExchange,
      parseExtractedLessons,
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
   * The `writing.lessons` task: the house gateway's cheap model unless the operator pinned
   * another — never the session's own, which may be BYOK, and a reflection is not the
   * operator's bill. Resolved before the transcript is read so an unavailable model costs
   * nothing.
   */
  let task: Awaited<ReturnType<typeof resolveAgentTask>>;
  try {
    task = await resolveAgentTask(db, AGENT_TASK_IDS.writingLessons);
  } catch {
    return { status: "unavailable", created: [] };
  }

  const repo = new PgSessionRepo(db, {
    kind: WRITING_AGENT_KIND,
    defaults: WRITING_SESSION_DEFAULTS,
  });
  const session = await repo.openById(request.sessionId);
  const [entries, leafId] = await Promise.all([
    session.getEntries(),
    session.getLeafId(),
  ]);

  const { items: lessons } = await listAgentMemories(db, {
    kind: AGENT_MEMORY_KIND.Lesson,
    limit: EXISTING_LESSONS_MAX,
  });
  const prompt = buildLessonExtractionPrompt({
    exchange: collectOperatorExchange(wholeBranch(entries, leafId)),
    existingLessons: lessons.filter(
      (lesson) => lesson.status !== AGENT_MEMORY_STATUS.Archived
    ),
    systemPrompt: task.systemPrompt,
  });
  if (!prompt) {
    return { status: "nothing", created: [] };
  }

  const reply = await completeText({
    models: task.models,
    model: task.model,
    systemPrompt: prompt.systemPrompt,
    text: prompt.text,
    ...task.params,
    signal: AbortSignal.timeout(LESSON_TIMEOUT_MS),
  });
  const extracted = reply ? parseExtractedLessons(reply) : [];

  const created: number[] = [];
  for (const lesson of extracted) {
    const saved = await createMemoryService(
      db,
      {
        kind: AGENT_MEMORY_KIND.Lesson,
        status: AGENT_MEMORY_STATUS.Pending,
        title: lesson.title,
        content: lesson.content,
        sessionId: request.sessionId,
      },
      memoryHooks
    );
    created.push(saved.id);
  }

  return { status: created.length > 0 ? "extracted" : "nothing", created };
};

/**
 * A retry after a partial write would insert the same lessons again, and a model failure is
 * already a normal `nothing`; there is no failure left that a retry would fix.
 */
consolidateSessionMemoryStep.maxRetries = 0;
