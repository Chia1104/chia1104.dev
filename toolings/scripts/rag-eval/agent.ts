import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { sql } from "drizzle-orm";

import { resolvePublicModel } from "@chia/agent-public/models";
import { publicPolicy, publicTurnBudget } from "@chia/agent-public/policy";
import { preparePublicTurn } from "@chia/agent-public/runtime";
import { accessOf, createAgentModels } from "@chia/agent-runtime/models";
import { runPiTurn } from "@chia/agent-runtime/pi/turn";
import { InMemorySessionTree } from "@chia/agent-runtime/session/tree";
import { connectDatabase, getConnection } from "@chia/db/client";
import { createContentReadPort } from "@chia/services/agent/content-read.port";

import { AGENT_TASKS } from "./agent-tasks.ts";
import type { AgentTask } from "./agent-tasks.ts";

/**
 * Agent-level eval: each task is one real public-kind turn against the real content port,
 * checked without a model judge. Retrieval metrics cannot see whether the agent enumerates
 * with `list_posts`, stops searching once it has the post, links only what a tool returned,
 * or declines when the corpus has no answer.
 *
 * Every run calls the model once per task on the operator's own key.
 *
 *   pnpm --filter rag-eval eval:agent                       # all tasks
 *   pnpm --filter rag-eval eval:agent id=count-2025         # one task
 *   pnpm --filter rag-eval eval:agent model=gpt-5.4-mini    # another OpenAI model
 *   pnpm --filter rag-eval eval:agent db-url=… out=agent.json
 */

/** The model the public kind runs in production, on the native provider the local key serves. */
const DEFAULT_MODEL_ID = "gpt-5.6-luna";
const PROVIDER_ID = "openai";

const DECLINES =
  /沒有|找不到|沒寫過|尚未|並未|未曾|no post|not find|couldn't find|hasn't written|does not|doesn't/i;

const parseArgs = (argv: string[]): Record<string, string> =>
  Object.fromEntries(
    argv
      .filter((arg) => arg.includes("="))
      .map((arg) => {
        const index = arg.indexOf("=");
        return [arg.slice(0, index), arg.slice(index + 1)];
      })
  );

interface ToolCall {
  name: string;
  /** Names of the arguments the model passed. */
  argumentNames: string[];
  /** The arguments as JSON, for the report. */
  arguments: string;
}

interface TaskResult {
  id: string;
  passed: boolean;
  failures: string[];
  toolCalls: ToolCall[];
  answer: string;
  durationMs: number;
}

/** Slugs of the posts and notes a text links or names by URL. */
const linkedSlugs = (text: string): string[] => [
  ...new Set(
    [...text.matchAll(/\/(?:posts|notes)\/([^\s)#"'<>\]]+)/g)].map((match) =>
      decodeURIComponent(match[1]!)
    )
  ),
];

const textOf = (blocks: readonly { type: string; text?: string }[]): string =>
  blocks.map((block) => (block.type === "text" ? block.text : "")).join("");

const check = (
  task: AgentTask,
  toolCalls: ToolCall[],
  toolOutput: string,
  answer: string,
  error: string | undefined
): string[] => {
  const failures: string[] = [];
  if (error) {
    failures.push(`turn failed: ${error}`);
  }
  if (!answer.trim()) {
    failures.push("no answer");
  }
  if (toolCalls.length > publicTurnBudget.maxToolCalls) {
    failures.push(
      `${toolCalls.length} tool calls, over the budget of ${publicTurnBudget.maxToolCalls}`
    );
  }

  const linked = linkedSlugs(answer);
  const grounded = new Set(linkedSlugs(toolOutput));
  for (const slug of linked) {
    if (!grounded.has(slug)) {
      failures.push(`links "${slug}", which no tool returned`);
    }
  }
  for (const slug of task.expectedSlugs ?? []) {
    if (!linked.includes(slug)) {
      failures.push(`does not link "${slug}"`);
    }
  }
  for (const name of task.expectedTools ?? []) {
    if (!toolCalls.some((call) => call.name === name)) {
      failures.push(`never called ${name}`);
    }
  }
  const [primary] = task.expectedTools ?? [];
  for (const argument of task.expectedArguments ?? []) {
    const carried = toolCalls.some(
      (call) => call.name === primary && call.argumentNames.includes(argument)
    );
    if (!carried) {
      failures.push(`no ${primary} call carried \`${argument}\``);
    }
  }
  for (const expected of task.expectedText ?? []) {
    if (!answer.includes(expected)) {
      failures.push(`answer lacks "${expected}"`);
    }
  }
  if (task.maxSearches !== undefined) {
    const searches = toolCalls.filter(
      (call) => call.name === "search_posts"
    ).length;
    if (searches > task.maxSearches) {
      failures.push(
        `${searches} searches, expected at most ${task.maxSearches}`
      );
    }
  }
  if (task.unanswerable && !DECLINES.test(answer)) {
    failures.push("does not say the corpus has no answer");
  }
  return failures;
};

const main = async (): Promise<void> => {
  const options = parseArgs(process.argv.slice(2));
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set; the agent eval runs a real model."
    );
  }

  const tasks = AGENT_TASKS.filter(
    (task) => !options.id || task.id === options.id
  );
  if (tasks.length === 0) {
    throw new Error("No agent task matches the given id.");
  }

  const db = options["db-url"]
    ? await getConnection(options["db-url"], { withCache: false })
    : await connectDatabase(options.env ?? "local", { withCache: false });

  // Whose posts these are. The apps read `ADMIN_ID`; an eval database may be a copy, so ask it.
  const authors = await db.execute<{ user_id: string }>(
    sql`select user_id from chia_feed where deleted_at is null group by 1 order by count(*) desc limit 1`
  );
  const authorId = authors.rows[0]?.user_id;
  if (!authorId) {
    throw new Error("The database holds no feeds.");
  }

  const credentials = { [PROVIDER_ID]: apiKey };
  const models = createAgentModels(credentials);
  const settings = {
    providerId: PROVIDER_ID,
    modelId: options.model ?? DEFAULT_MODEL_ID,
    thinkingLevel: "off" as const,
    activeToolNames: null,
    autoApprove: [],
  };
  const model = resolvePublicModel(settings, models, accessOf(credentials));
  const content = createContentReadPort({
    db,
    authorId,
    visibility: "public",
  });

  console.log(
    `Agent eval — ${tasks.length} task(s) · ${settings.providerId}/${settings.modelId}\n`
  );

  const results: TaskResult[] = [];
  // Serial: one visitor at a time is what the budget and the latency describe.
  for (const task of tasks) {
    const session = new InMemorySessionTree(`eval-${task.id}`);
    const startedAt = performance.now();
    let error: string | undefined;
    try {
      await runPiTurn({
        ...(await preparePublicTurn({
          content,
          profile: { listPublished: () => Promise.resolve([]) },
          guard: null,
        })),
        policy: publicPolicy,
        session,
        settings,
        agentSessionId: `eval-${task.id}`,
        model,
        models,
        message: { text: task.prompt },
        onEvent: () => undefined,
        persistApproval: () => Promise.resolve(undefined),
      });
    } catch (caught) {
      error = String(caught);
    }
    const durationMs = performance.now() - startedAt;

    const messages = (await session.getEntries()).flatMap((entry) =>
      entry.type === "message" ? [entry.message] : []
    );
    const toolCalls: ToolCall[] = messages.flatMap((message) =>
      message.role === "assistant"
        ? message.content.flatMap((block) =>
            block.type === "toolCall"
              ? [
                  {
                    name: block.name,
                    argumentNames: Object.keys(block.arguments),
                    arguments: JSON.stringify(block.arguments),
                  },
                ]
              : []
          )
        : []
    );
    const toolOutput = messages
      .flatMap((message) =>
        message.role === "toolResult" ? [textOf(message.content)] : []
      )
      .join("\n");
    const answer =
      messages
        .flatMap((message) =>
          message.role === "assistant" ? [textOf(message.content)] : []
        )
        .at(-1) ?? "";

    const failures = check(task, toolCalls, toolOutput, answer, error);
    results.push({
      id: task.id,
      passed: failures.length === 0,
      failures,
      toolCalls,
      answer,
      durationMs,
    });

    const calls =
      toolCalls.map((call) => call.name).join(" → ") || "(no tools)";
    console.log(
      `${failures.length === 0 ? "pass" : "FAIL"}  ${task.id}  ${Math.round(durationMs)}ms  ${calls}`
    );
    for (const failure of failures) {
      console.log(`      ${failure}`);
    }
  }

  const passed = results.filter((result) => result.passed).length;
  console.log(`\n${passed}/${results.length} tasks passed`);

  if (options.out) {
    mkdirSync(dirname(options.out), { recursive: true });
    writeFileSync(
      options.out,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          model: `${settings.providerId}/${settings.modelId}`,
          results,
        },
        null,
        2
      )
    );
    console.log(`report written to ${options.out}`);
  }

  process.exit(passed === results.length ? 0 : 1);
};

await main();
