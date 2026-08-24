import * as z from "zod";

import type {
  PromptScreenPort,
  PromptScreenReason,
  PromptScreenSignal,
  PromptScreenVerdict,
} from "@chia/api/orpc/services/prompt-screen";
import type { JsonObject } from "@chia/utils/json";

import { env } from "../env";

/**
 * {@link PromptScreenPort} on two classifiers, called in parallel:
 *
 * - **Llama Prompt Guard 2 (86M)** via Hugging Face Inference — injection/jailbreak phrasing.
 *   The model reads 512 tokens, so longer text is screened in paragraph chunks and any single
 *   malicious chunk blocks: an injection is usually appended to an otherwise ordinary prompt.
 * - **OpenAI Moderation** (`omni-moderation-latest`) — harmful content. `flagged` is trusted
 *   as-is; OpenAI calibrates its own thresholds.
 *
 * **Fails open.** A classifier that errors contributes an `error` signal and no verdict: the
 * kinds that screen are read-only and turn-budgeted, so letting one prompt through costs tokens,
 * while failing closed turns a classifier outage into a full outage of the public agent. Both
 * failing at once still allows, but the recorded signals make the blind spot visible.
 *
 * Thresholds and timeouts are constants, not env: they are part of what this port *is*, and
 * tuning them is a code change reviewed like one. The keys are env, checked at construction so a
 * kind cannot silently run unscreened because a variable is missing.
 */

const PROMPT_GUARD_MODEL = "meta-llama/Llama-Prompt-Guard-2-86M";
const PROMPT_GUARD_URL = `https://router.huggingface.co/hf-inference/models/${PROMPT_GUARD_MODEL}`;
const MODERATION_URL = "https://api.openai.com/v1/moderations";

/** Meta's suggested operating point; tune from `agent.prompt_screen` once real traffic lands. */
const PROMPT_GUARD_BLOCK_SCORE = 0.8;
/** The model's context is 512 tokens; ~4 chars/token keeps chunks safely inside it. */
const PROMPT_GUARD_CHUNK_CHARS = 1_500;
const CLASSIFIER_TIMEOUT_MS = 5_000;

/** `text-classification` answers one array of label scores per input. */
const promptGuardResponseSchema = z
  .array(z.array(z.object({ label: z.string(), score: z.number() })))
  .or(z.array(z.object({ label: z.string(), score: z.number() })));

const moderationResponseSchema = z.object({
  results: z
    .array(
      z.object({
        flagged: z.boolean(),
        categories: z.record(z.string(), z.boolean()),
        category_scores: z.record(z.string(), z.number()),
      })
    )
    .min(1),
});

/** Paragraph-first split; a single paragraph longer than one chunk is sliced flat. */
export const chunkForPromptGuard = (text: string): string[] => {
  const chunks: string[] = [];
  let current = "";
  for (const paragraph of text.split(/\n{2,}/)) {
    for (
      let offset = 0;
      offset < paragraph.length;
      offset += PROMPT_GUARD_CHUNK_CHARS
    ) {
      const piece = paragraph.slice(offset, offset + PROMPT_GUARD_CHUNK_CHARS);
      if (current.length + piece.length > PROMPT_GUARD_CHUNK_CHARS && current) {
        chunks.push(current);
        current = piece;
      } else {
        current = current ? `${current}\n\n${piece}` : piece;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [text];
};

interface SourceOutcome {
  signal: PromptScreenSignal;
  reason?: PromptScreenReason;
}

const failedSignal = (
  source: PromptScreenSignal["source"],
  cause: unknown
): SourceOutcome => ({
  signal: {
    source,
    label: "unavailable",
    score: 0,
    error: cause instanceof Error ? cause.message : String(cause),
  },
});

export const createPromptScreenPort = (): PromptScreenPort => {
  const hfToken = env.HF_TOKEN;
  const openaiKey = env.OPENAI_API_KEY;
  if (!hfToken) throw new Error("Prompt screening requires HF_TOKEN.");
  if (!openaiKey) {
    throw new Error("Prompt screening requires OPENAI_API_KEY.");
  }

  const post = async <T>(
    url: string,
    headers: Record<string, string>,
    body: JsonObject,
    schema: z.ZodType<T>,
    signal: AbortSignal
  ): Promise<T> => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.any([
        signal,
        AbortSignal.timeout(CLASSIFIER_TIMEOUT_MS),
      ]),
    });
    if (!response.ok) {
      // The status is the diagnosis; the body may echo the screened text, so it stays out.
      throw new Error(`HTTP ${response.status}`);
    }
    return schema.parse(await response.json());
  };

  const runPromptGuard = async (
    text: string,
    signal: AbortSignal
  ): Promise<SourceOutcome> => {
    try {
      const chunks = chunkForPromptGuard(text);
      const responses = await Promise.all(
        chunks.map((chunk) =>
          post(
            PROMPT_GUARD_URL,
            { authorization: `Bearer ${hfToken}` },
            { inputs: chunk },
            promptGuardResponseSchema,
            signal
          )
        )
      );
      let worst = { label: "benign", score: 0 };
      for (const response of responses) {
        for (const entry of response.flat()) {
          const malicious =
            entry.label.toLowerCase() === "malicious" ||
            entry.label === "LABEL_1";
          if (malicious && entry.score > worst.score) {
            worst = { label: "malicious", score: entry.score };
          }
        }
      }
      return {
        signal: { source: "prompt-guard", ...worst },
        reason:
          worst.score >= PROMPT_GUARD_BLOCK_SCORE ? "injection" : undefined,
      };
    } catch (cause) {
      return failedSignal("prompt-guard", cause);
    }
  };

  const runModeration = async (
    text: string,
    signal: AbortSignal
  ): Promise<SourceOutcome> => {
    try {
      const response = await post(
        MODERATION_URL,
        { authorization: `Bearer ${openaiKey}` },
        { model: "omni-moderation-latest", input: text },
        moderationResponseSchema,
        signal
      );
      const result = response.results[0];
      /* SAFETY: The schema requires at least one result. */
      const { flagged, categories, category_scores } = result!;
      let label = "flagged";
      let score = 0;
      for (const [category, hit] of Object.entries(categories)) {
        const categoryScore = category_scores[category] ?? 0;
        if (hit && categoryScore > score) {
          label = category;
          score = categoryScore;
        }
      }
      return {
        signal: { source: "openai-moderation", label, score },
        reason: flagged ? "harmful" : undefined,
      };
    } catch (cause) {
      return failedSignal("openai-moderation", cause);
    }
  };

  return {
    async screen(input, signal): Promise<PromptScreenVerdict> {
      const [guard, moderation] = await Promise.all([
        runPromptGuard(input.text, signal),
        runModeration(input.text, signal),
      ]);
      const signals = [guard.signal, moderation.signal];

      // Injection first: when both fire, the injection reading is the one worth investigating.
      const reason = guard.reason ?? moderation.reason;
      if (reason) return { verdict: "block", reason, signals };

      if (guard.signal.error && moderation.signal.error) {
        // Both classifiers down: the screen is blind, not closed. Surface it loudly.
        console.error(
          "prompt-screen: every classifier failed; allowing unscreened",
          { causes: [guard.signal.error, moderation.signal.error] }
        );
      }
      return { verdict: "allow", signals };
    },
  };
};
