import {
  AgentProvider,
  createAgentCatalog,
  createAgentModels,
  HOUSE_ACCESS,
  houseModel,
  listModels,
  loadGatewayPrices,
  modelRefOf,
  NO_ACCESS,
  resolveModel,
  UnknownAgentModelError,
} from "@chia/agent-runtime/models";
import type {
  AgentCredentials,
  AgentModel,
  AgentModels,
  AgentModelInfo,
  AgentModelPredicate,
  AgentModelRef,
  GatewayPrices,
} from "@chia/agent-runtime/models";
import {
  SESSION_TITLE_PARAMS,
  SESSION_TITLE_SYSTEM_PROMPT,
} from "@chia/agent-runtime/title";
import {
  LESSON_EXTRACTION_PARAMS,
  LESSON_EXTRACTION_SYSTEM_PROMPT,
} from "@chia/agent-writing/memory/lessons";
import { WRITING_AGENT_KIND } from "@chia/agent-writing/models";
import type { DB } from "@chia/db/client";
import { getAgentTaskConfig } from "@chia/db/repos/agent/config";
import type { AgentTaskParams } from "@chia/db/schema";
import { logger } from "@chia/observability/logger";

import {
  FEED_SUMMARY_PARAMS,
  FEED_SUMMARY_SYSTEM_PROMPT,
} from "./feed-summary";
import {
  REPORT_TRIAGE_PARAMS,
  REPORT_TRIAGE_SYSTEM_PROMPT,
} from "./report-triage";

/**
 * One-shot model calls beside a session (title, lesson extraction, compaction), on the
 * operator's request (post summary) or on a reader's report (triage). The definition
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
   * The model when the operator has not chosen one: a house ref, or `"session"` for a task
   * that runs on the model of the session it serves. A fixed model is always resolved on the
   * house account over the gateway: a side job is never the operator's own bill, and it may
   * run in a workflow that has no caller credentials.
   */
  readonly defaultModel: AgentModelRef | "session";
  /** Absent when the call's prompt is not the operator's to write (Pi's compaction carries its own). */
  readonly prompt?: { readonly default: string };
  /** Absent when the call's sampling is not exposed (Pi shapes its own compaction call). */
  readonly params?: AgentTaskParamsResolved;
}

export const AgentTaskId = {
  SessionTitle: "session.title",
  SessionCompaction: "session.compaction",
  SessionBranchSummary: "session.branch-summary",
  WritingLessons: "writing.lessons",
  FeedSummary: "feed.summary",
  ReportTriage: "report.triage",
} as const;

export type AgentTaskId = (typeof AgentTaskId)[keyof typeof AgentTaskId];

export const AGENT_TASKS = {
  [AgentTaskId.SessionTitle]: {
    id: AgentTaskId.SessionTitle,
    label: "Session title",
    description:
      "Condenses the first prompt of a session into the short title shown in the session list.",
    defaultModel: houseModel("cheap"),
    prompt: { default: SESSION_TITLE_SYSTEM_PROMPT },
    params: SESSION_TITLE_PARAMS,
  },
  [AgentTaskId.SessionCompaction]: {
    id: AgentTaskId.SessionCompaction,
    label: "Compaction",
    description:
      "Summarises the transcript when it nears the model's context window, and on request.",
    defaultModel: "session",
  },
  [AgentTaskId.SessionBranchSummary]: {
    id: AgentTaskId.SessionBranchSummary,
    label: "Branch summary",
    description:
      "Summarises the messages left behind by a rewind, when the operator asks to keep the gist.",
    defaultModel: "session",
  },
  [AgentTaskId.WritingLessons]: {
    id: AgentTaskId.WritingLessons,
    label: "Lesson extraction",
    description:
      "Reads a finished writing session and proposes the lessons the operator taught the agent, for review.",
    kind: WRITING_AGENT_KIND,
    defaultModel: houseModel("cheap"),
    prompt: { default: LESSON_EXTRACTION_SYSTEM_PROMPT },
    params: LESSON_EXTRACTION_PARAMS,
  },
  [AgentTaskId.FeedSummary]: {
    id: AgentTaskId.FeedSummary,
    label: "Post summary",
    description:
      "Writes the abstract shown above a published post, one per language, when the editor asks for it.",
    defaultModel: houseModel("content"),
    prompt: { default: FEED_SUMMARY_SYSTEM_PROMPT },
    params: FEED_SUMMARY_PARAMS,
  },
  [AgentTaskId.ReportTriage]: {
    id: AgentTaskId.ReportTriage,
    label: "Report triage",
    description:
      "Reads a reader's correction against the published post and suggests exact edits for review, before the report reaches the inbox.",
    defaultModel: houseModel("cheap"),
    prompt: { default: REPORT_TRIAGE_SYSTEM_PROMPT },
    params: REPORT_TRIAGE_PARAMS,
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

/** House-billed, so the gateway only; a task never rides a caller's key. */
export const isAgentTaskModel: AgentModelPredicate = (ref) =>
  ref.providerId === AgentProvider.Gateway;

/** Throws `UnknownAgentModelError` when the pair is off the house catalogue. */
export const assertAgentTaskModel = (ref: AgentModelRef): void => {
  resolveModel(ref, isAgentTaskModel, createAgentCatalog(), HOUSE_ACCESS);
};

export const listAgentTaskModels = (): AgentModelInfo[] =>
  listModels(isAgentTaskModel, { access: HOUSE_ACCESS });

export interface ResolvedAgentTask {
  model: AgentModel;
  models: AgentModels;
  /** The keys `models` carries, for the usage ledger; none when the task runs on the house. */
  credentials: AgentCredentials;
  systemPrompt?: string;
  params?: AgentTaskParamsResolved;
}

export interface ResolveAgentTaskOptions {
  /**
   * The session the task serves, for a task whose effective model is `"session"`. A thunk so a
   * task pinned to a fixed model never resolves the session's own, which may need a BYOK key
   * the request does not carry.
   */
  session?: () => {
    model: AgentModel;
    models: AgentModels;
    credentials: AgentCredentials;
  };
}

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

  const pinned = modelRefOf(row);
  // A task on a house model is billed at the gateway's prices; one on the session model is
  // priced by the session's own collection.
  const prices =
    pinned || definition.defaultModel !== "session"
      ? await loadGatewayPrices()
      : undefined;
  const resolved =
    (pinned && resolveFixed(pinned, prices)) ??
    (pinned && warnStale(taskId, pinned)) ??
    resolveDefault(definition, options, prices);

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
  ref: AgentModelRef,
  prices: GatewayPrices | undefined
): Pick<ResolvedAgentTask, "model" | "models" | "credentials"> | null => {
  const models = createAgentModels({}, prices);
  try {
    return {
      model: resolveModel(ref, isAgentTaskModel, models, NO_ACCESS),
      models,
      credentials: {},
    };
  } catch (error) {
    if (error instanceof UnknownAgentModelError) return null;
    throw error;
  }
};

const warnStale = (taskId: string, ref: AgentModelRef): null => {
  logger.warn(
    { taskId, providerId: ref.providerId, modelId: ref.modelId },
    "Agent task is pinned to a model the catalogue no longer carries; using its default"
  );
  return null;
};

const resolveDefault = (
  definition: AgentTaskDefinition,
  options: ResolveAgentTaskOptions,
  prices: GatewayPrices | undefined
): Pick<ResolvedAgentTask, "model" | "models" | "credentials"> => {
  if (definition.defaultModel === "session") {
    if (!options.session) {
      throw new Error(
        `Agent task "${definition.id}" runs on the session model, but no session was supplied.`
      );
    }
    return options.session();
  }
  const fixed = resolveFixed(definition.defaultModel, prices);
  if (!fixed) throw new UnknownAgentModelError(definition.defaultModel);
  return fixed;
};
