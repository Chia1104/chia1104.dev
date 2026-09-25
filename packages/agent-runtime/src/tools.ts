import type * as z from "zod";

/**
 * A kind's tools, declared with zod: the schema is what the model is offered and what its
 * arguments are parsed with before `execute` sees them. The runtime binds them to Pi for a turn.
 */

/** What a tool call produced: `text` is what the model reads, `details` what clients render. */
export interface ToolResult<TDetails = unknown> {
  text: string;
  details?: TDetails;
}

/** The call an `execute` serves. */
export interface ToolCall {
  toolCallId: string;
  /** The turn's abort; a host port that can stop early should. */
  signal?: AbortSignal;
}

/**
 * A tool's model-facing half, readable without a turn's ports.
 *
 * An optional parameter is offered to the model as nullable, and a `null` it sends is dropped
 * before parsing: a model that fills every field otherwise invents a value (a lesson id, a
 * heading of `##`). A parameter that is itself nullable keeps its `null`.
 */
export interface ToolSpec<TParameters extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  parameters: TParameters;
  /**
   * `sequential` runs the call on its own, after the batch's earlier calls: a tool whose effect a
   * later call in the same reply depends on, or that two concurrent calls would race on.
   * @default "parallel"
   */
  executionMode?: "sequential" | "parallel";
}

/** A tool bound to one turn's ports. Throwing hands the model an error result with the message. */
export interface AgentTool<
  TParameters extends z.ZodType = z.ZodType,
> extends ToolSpec<TParameters> {
  /**
   * Receives the arguments parsed with `parameters`. A method, so a tool typed for its own
   * parameters still fits a kind's `AgentTool[]`.
   */
  execute(params: z.output<TParameters>, call: ToolCall): Promise<ToolResult>;
}

/**
 * A tool declared once: called with a turn's ports it yields the tool the turn runs, and its
 * `spec` is readable without a turn, so the capabilities a kind advertises and the tools it
 * binds come from the same list.
 */
export interface ToolFactory<
  TContext,
  TParameters extends z.ZodType = z.ZodType,
> {
  (context: TContext): AgentTool<TParameters>;
  readonly spec: ToolSpec<TParameters>;
}

/** Pairs a spec with an `execute` closed over one turn's ports. */
export const defineTool = <TContext, TParameters extends z.ZodType>(
  spec: ToolSpec<TParameters>,
  execute: (context: TContext) => AgentTool<TParameters>["execute"]
): ToolFactory<TContext, TParameters> =>
  Object.assign(
    (context: TContext): AgentTool<TParameters> => ({
      ...spec,
      execute: execute(context),
    }),
    { spec }
  );

/** Fenced JSON for the model. Tools return prose + JSON so the model gets an explicit framing sentence. */
export const jsonBlock = <TValue>(value: TValue): string =>
  `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;

/** Truncates with an explicit marker so the model knows it saw a prefix and can ask for more. */
export const truncate = (text: string, maxChars: number) => {
  if (text.length <= maxChars) return { text, truncated: false } as const;
  return {
    text: `${text.slice(0, maxChars)}\n\n… [truncated ${text.length - maxChars} more characters]`,
    truncated: true,
  } as const;
};
