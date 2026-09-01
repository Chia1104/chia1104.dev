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
 * One-shot model calls beside a session (title, lesson extraction, compaction). The definition
 * is the code's choice, `agent.task_config` the operator's override, and {@link resolveAgentTask}
 * the only place the two meet. A task is code; a row only re-points it.
 */

export interface AgentTaskParamsResolved {
  maxTokens: number;
  temperature: number;
}

export interface AgentTaskDefinition {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly kind?: string;
  /**
   * The model when the operator has not chosen one: a house gateway ref, or `"session"` for a
   * task that runs on the model of the session it serves. A fixed model is always resolved on
   * the house account: a side job is never the operator's own bill, and it may run in a
   * workflow that has no caller credentials.
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

const definitions: readonly AgentTaskDefinition[] = Object.values(AGENT_TASKS);

export const listAgentTaskDefinitions = (): AgentTaskDefinition[] => [
  ...definitions,
];

export const getAgentTaskDefinition = (
  taskId: string
): AgentTaskDefinition | undefined =>
  definitions.find((definition) => definition.id === taskId);

export const isAgentTaskModel = (ref: AgentModelRef): boolean =>
  ref.providerId === AGENT_PROVIDERS.gateway;

/** Throws `UnknownAgentModelError` when the pair is off the house catalogue. */
export const assertAgentTaskModel = (ref: AgentModelRef): void => {
  resolveModel(ref, isAgentTaskModel, createAgentCatalog());
};

export const listAgentTaskModels = (): AgentModelInfo[] =>
  listModels(isAgentTaskModel);

export interface ResolvedAgentTask {
  model: AgentModel;
  models: AgentModels;
  systemPrompt?: string;
  params?: AgentTaskParamsResolved;
}

export interface ResolveAgentTaskOptions {
  /**
   * The session the task serves, for a task whose effective model is `"session"`. A thunk so a
   * task pinned to a fixed model never resolves the session's own, which may need a BYOK key
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
 * The model, prompt and parameters a task runs with: the operator's row over the definition.
 * A pinned model the catalogue no longer carries falls back to the definition's default with a
 * warning, so a pi-ai upgrade that retires a model id degrades the task rather than the work
 * it rides alongside.
 */
export const resolveAgentTask = async (
  db: DB,
  taskId: string,
  options: ResolveAgentTaskOptions = {}
): Promise<ResolvedAgentTask> => {
  const definition = getAgentTaskDefinition(taskId);
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
