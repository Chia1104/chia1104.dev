import {
  AGENT_PROVIDERS,
  createAgentCatalog,
  createAgentModels,
  listModels,
  resolveModel,
  UnknownAgentModelError,
} from "@chia/agent-runtime/models";
import type {
  AgentModel,
  AgentModelInfo,
  AgentModelRef,
} from "@chia/agent-runtime/models";
import {
  SESSION_TITLE_PARAMS,
  SESSION_TITLE_SYSTEM_PROMPT,
} from "@chia/agent-runtime/pi/title";
import {
  LESSON_EXTRACTION_PARAMS,
  LESSON_EXTRACTION_SYSTEM_PROMPT,
} from "@chia/agent-writing/memory/lessons";
import { WRITING_AGENT_KIND } from "@chia/agent-writing/models";
import type { DB } from "@chia/db/client";
import { getAgentTaskConfig } from "@chia/db/repos/agent/config";
import type { AgentTaskConfig, AgentTaskParams } from "@chia/db/schema";

import type { AgentModels } from "./kind";

/**
 * The agent tasks this process runs — the one place a task is registered.
 *
 * A task is a named, one-shot model call that rides alongside a session rather than being one:
 * naming a session, extracting lessons, compacting a transcript. What they share is not how
 * they run — one is `completeSimple`, another is Pi's `compact()` — but what the operator
 * wants to choose about them: the model, the prompt where there is one, and the sampling
 * parameters. A definition states the code's choice for each; `agent.task_config` holds the
 * operator's override; {@link resolveAgentTask} is the one place the two meet.
 *
 * Like `AGENT_KINDS`, a task is code and a row only re-points it: the step that runs the task
 * ships with the deployment, so nothing here can be created from the dashboard.
 *
 * This module imports prompt text from the domain packages, so it is loaded on first use — by
 * the steps that run tasks and by the admin service — and never at boot.
 */

export interface AgentTaskParamsResolved {
  maxTokens: number;
  temperature: number;
}

export interface AgentTaskDefinition {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  /** The kind the task belongs to; absent for one every kind shares. */
  readonly kind?: string;
  /**
   * The model when the operator has not chosen one: a house gateway ref, or `"session"` for a
   * task that runs on the model of the session it serves. A fixed model is always resolved on
   * the house account — a side job is never the operator's own bill, and it may run in a
   * workflow that has no caller credentials at all.
   */
  readonly defaultModel: AgentModelRef | "session";
  /** Absent when the call's prompt is not the operator's to write (Pi's compaction carries its own). */
  readonly prompt?: { readonly default: string };
  /** Absent when the call's sampling is not exposed (Pi shapes its own compaction call). */
  readonly params?: AgentTaskParamsResolved;
}

export const AGENT_TASK_IDS = {
  sessionTitle: "session.title",
  sessionCompaction: "session.compaction",
  sessionBranchSummary: "session.branch-summary",
  writingLessons: "writing.lessons",
} as const;

export type AgentTaskId = (typeof AGENT_TASK_IDS)[keyof typeof AGENT_TASK_IDS];

/** The house gateway's cheap model — what a side job runs on unless the operator says otherwise. */
const HOUSE_CHEAP_MODEL: AgentModelRef = {
  providerId: AGENT_PROVIDERS.gateway,
  modelId: "anthropic/claude-haiku-4.5",
};

export const AGENT_TASKS = {
  [AGENT_TASK_IDS.sessionTitle]: {
    id: AGENT_TASK_IDS.sessionTitle,
    label: "Session title",
    description:
      "Condenses the first prompt of a session into the short title shown in the session list.",
    defaultModel: HOUSE_CHEAP_MODEL,
    prompt: { default: SESSION_TITLE_SYSTEM_PROMPT },
    params: SESSION_TITLE_PARAMS,
  },
  [AGENT_TASK_IDS.sessionCompaction]: {
    id: AGENT_TASK_IDS.sessionCompaction,
    label: "Compaction",
    description:
      "Summarises the transcript when it nears the model's context window, and on request.",
    defaultModel: "session",
  },
  [AGENT_TASK_IDS.sessionBranchSummary]: {
    id: AGENT_TASK_IDS.sessionBranchSummary,
    label: "Branch summary",
    description:
      "Summarises the messages left behind by a rewind, when the operator asks to keep the gist.",
    defaultModel: "session",
  },
  [AGENT_TASK_IDS.writingLessons]: {
    id: AGENT_TASK_IDS.writingLessons,
    label: "Lesson extraction",
    description:
      "Reads a finished writing session and proposes the lessons the operator taught the agent, for review.",
    kind: WRITING_AGENT_KIND,
    defaultModel: HOUSE_CHEAP_MODEL,
    prompt: { default: LESSON_EXTRACTION_SYSTEM_PROMPT },
    params: LESSON_EXTRACTION_PARAMS,
  },
} satisfies Readonly<Record<AgentTaskId, AgentTaskDefinition>>;

/** `AGENT_TASKS` keyed by id; a `Map` keeps prototype names from matching. */
const definitions = new Map<string, AgentTaskDefinition>(
  Object.entries(AGENT_TASKS)
);

export const listAgentTaskDefinitions = (): AgentTaskDefinition[] => [
  ...definitions.values(),
];

export const getAgentTaskDefinition = (
  taskId: string
): AgentTaskDefinition | undefined => definitions.get(taskId);

// ============================================
// Models a task may be pinned to
// ============================================

/** A fixed task model is a house gateway model; see {@link AgentTaskDefinition.defaultModel}. */
export const isAgentTaskModel = (ref: AgentModelRef): boolean =>
  ref.providerId === AGENT_PROVIDERS.gateway;

/** Throws `UnknownAgentModelError` when the pair is off the house catalogue. */
export const assertAgentTaskModel = (ref: AgentModelRef): void => {
  resolveModel(ref, isAgentTaskModel, createAgentCatalog());
};

export const listAgentTaskModels = (): AgentModelInfo[] =>
  listModels(isAgentTaskModel);

// ============================================
// Resolution
// ============================================

export interface ResolvedAgentTask {
  model: AgentModel;
  /** The collection `model` was resolved from — what the call must be made on. */
  models: AgentModels;
  /** The effective system prompt; absent for a task without one. */
  systemPrompt?: string;
  /** The effective sampling parameters; absent for a task without them. */
  params?: AgentTaskParamsResolved;
}

export interface ResolveAgentTaskOptions {
  /**
   * The session the task serves, for a task whose effective model is `"session"`. A thunk so a
   * task pinned to a fixed model never resolves the session's own — which may need a BYOK key
   * the request does not carry.
   */
  session?: () => { model: AgentModel; models: AgentModels };
}

/** The `(providerId, modelId)` pair on a row, or nothing; the two are written together. */
export const taskRowModel = (
  row: Pick<AgentTaskConfig, "providerId" | "modelId"> | undefined
): AgentModelRef | null =>
  row?.providerId && row.modelId
    ? { providerId: row.providerId, modelId: row.modelId }
    : null;

/** Only the parameters the operator set; the rest come from the definition. */
export const definedTaskParams = (
  params: AgentTaskParams | undefined
): Partial<AgentTaskParamsResolved> => ({
  ...(params?.maxTokens !== undefined && { maxTokens: params.maxTokens }),
  ...(params?.temperature !== undefined && {
    temperature: params.temperature,
  }),
});

/**
 * The model, prompt and parameters a task runs with right now: the operator's row over the
 * definition. A pinned model that the catalogue no longer carries falls back to the definition's
 * default with a warning, so a pi-ai upgrade that retires a model id degrades the task rather
 * than the work it rides alongside.
 */
export const resolveAgentTask = async (
  db: DB,
  taskId: string,
  options: ResolveAgentTaskOptions = {}
): Promise<ResolvedAgentTask> => {
  const definition = definitions.get(taskId);
  if (!definition) throw new Error(`Unknown agent task: ${taskId}`);
  const row = await getAgentTaskConfig(db, taskId);

  const pinned = taskRowModel(row);
  const resolved =
    (pinned && resolveFixed(pinned)) ??
    (pinned && warnStale(taskId, pinned)) ??
    resolveDefault(definition, options);

  return {
    ...resolved,
    systemPrompt: definition.prompt
      ? (row?.systemPrompt ?? definition.prompt.default)
      : undefined,
    params: definition.params
      ? { ...definition.params, ...definedTaskParams(row?.params) }
      : undefined,
  };
};

const resolveFixed = (
  ref: AgentModelRef
): Pick<ResolvedAgentTask, "model" | "models"> | null => {
  const models = createAgentModels();
  const model = models.getModel(ref.providerId, ref.modelId);
  return model ? { model, models } : null;
};

const warnStale = (taskId: string, ref: AgentModelRef): null => {
  console.warn(
    `Agent task "${taskId}" is pinned to ${ref.providerId}/${ref.modelId}, which the catalogue no longer carries; using its default model.`
  );
  return null;
};

const resolveDefault = (
  definition: AgentTaskDefinition,
  options: ResolveAgentTaskOptions
): Pick<ResolvedAgentTask, "model" | "models"> => {
  if (definition.defaultModel === "session") {
    if (!options.session) {
      throw new Error(
        `Agent task "${definition.id}" runs on the session model, but no session was supplied.`
      );
    }
    return options.session();
  }
  const fixed = resolveFixed(definition.defaultModel);
  if (!fixed) throw new UnknownAgentModelError(definition.defaultModel);
  return fixed;
};
