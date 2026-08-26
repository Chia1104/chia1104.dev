import { FatalError } from "workflow";

import { AGENT_PROVIDERS, createAgentModels } from "@chia/agent-runtime/models";
import { completeText } from "@chia/agent-runtime/pi/complete";
import { PgSessionRepo } from "@chia/agent-runtime/session/pg-repo";
import {
  buildLessonExtractionPrompt,
  collectOperatorExchange,
  parseExtractedLessons,
  wholeBranch,
} from "@chia/agent-writing/memory/lessons";
import {
  WRITING_AGENT_KIND,
  WRITING_SESSION_DEFAULTS,
} from "@chia/agent-writing/models";
import { createMemoryService } from "@chia/api/memories/write";
import { connectDatabase } from "@chia/db/client";
import { getAgentSession } from "@chia/db/repos/agent";
import { listAgentMemories } from "@chia/db/repos/agent/memory";
import { AGENT_MEMORY_KIND, AGENT_MEMORY_STATUS } from "@chia/db/schema";

import { memoryHooks } from "../services/agent-memory-indexing.service";

/**
 * The house gateway's cheap model, as for session titles. Pinned rather than read from the
 * session: the session's own model may be BYOK, and a reflection is not the operator's bill.
 */
const LESSON_MODEL_ID = "anthropic/claude-haiku-4.5";
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
  });
  if (!prompt) {
    return { status: "nothing", created: [] };
  }

  const models = createAgentModels();
  const model = models.getModel(AGENT_PROVIDERS.gateway, LESSON_MODEL_ID);
  if (!model) {
    return { status: "unavailable", created: [] };
  }

  const reply = await completeText({
    models,
    model,
    systemPrompt: prompt.systemPrompt,
    text: prompt.text,
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
