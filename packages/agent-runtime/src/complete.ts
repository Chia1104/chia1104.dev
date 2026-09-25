import { chat } from "@tanstack/ai";
import type { TokenUsage } from "@tanstack/ai";

import { logger } from "@chia/observability/logger";

import type { Usage } from "./messages.ts";
import type { AgentModelBinding, SamplingParams } from "./models.ts";
import { samplingOptions, usageOf } from "./models.ts";
import { modelSpans } from "./telemetry.ts";
import type { AgentModelUsage } from "./types.ts";

/** One tool-less model call: side jobs, titles and summaries. */

export interface CompleteOptions extends SamplingParams {
  binding: AgentModelBinding;
  systemPrompt: string;
  /** The single user message the model answers. */
  prompt: string;
  signal?: AbortSignal;
}

export interface Completion {
  text: string;
  /** What the call was billed; an aborted or failed call is billed too. */
  usage: Usage | undefined;
}

export class CompletionError extends Error {
  constructor(
    message: string,
    readonly aborted: boolean,
    readonly usage: Usage | undefined
  ) {
    super(message);
    this.name = "CompletionError";
  }
}

/** Throws {@link CompletionError} when the provider fails or the call is aborted. */
export const complete = async ({
  binding,
  systemPrompt,
  prompt,
  signal,
  ...sampling
}: CompleteOptions): Promise<Completion> => {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener("abort", abort, { once: true });

  let text = "";
  let usage: TokenUsage | undefined;
  let failure: string | undefined;
  try {
    const stream = chat({
      adapter: binding.adapter,
      messages: [{ role: "user", content: prompt }],
      systemPrompts: [systemPrompt],
      modelOptions: {
        ...binding.modelOptions,
        ...samplingOptions(binding, sampling),
      },
      abortController: controller,
      middleware: [
        modelSpans(binding),
        {
          name: "completion-usage",
          onUsage: (_ctx, reported) => {
            usage = reported;
          },
        },
      ],
    });
    for await (const chunk of stream) {
      if (chunk.type === "TEXT_MESSAGE_CONTENT") text += chunk.delta;
      if (chunk.type === "RUN_ERROR") {
        failure =
          chunk.message ?? chunk.error?.message ?? "The provider failed.";
      }
    }
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  } finally {
    signal?.removeEventListener("abort", abort);
  }

  const billed = usage ? usageOf(binding, usage) : undefined;
  if (controller.signal.aborted) {
    throw new CompletionError("The completion was aborted.", true, billed);
  }
  if (failure !== undefined) throw new CompletionError(failure, false, billed);
  return { text, usage: billed };
};

export interface CompleteTextOptions extends CompleteOptions {
  /** What the call was billed, whatever it replied. */
  onUsage?: (usage: AgentModelUsage) => void | Promise<void>;
}

/**
 * {@link complete} for side jobs that must never fail the work they ride alongside: every
 * failure path resolves `null`, an empty reply included.
 */
export const completeText = async ({
  onUsage,
  ...options
}: CompleteTextOptions): Promise<string | null> => {
  const report = async (usage: Usage | undefined) => {
    if (!usage) return;
    await onUsage?.({
      providerId: options.binding.model.providerId,
      modelId: options.binding.model.modelId,
      usage,
    });
  };
  try {
    const completion = await complete(options);
    await report(completion.usage);
    const out = completion.text.trim();
    return out.length > 0 ? out : null;
  } catch (error) {
    if (error instanceof CompletionError) {
      await report(error.usage);
      if (!error.aborted) {
        logger.warn(
          { model: options.binding.model.modelId, detail: error.message },
          "Completion request failed"
        );
      }
      return null;
    }
    logger.warn(
      { err: error, model: options.binding.model.modelId },
      "Completion request failed"
    );
    return null;
  }
};
