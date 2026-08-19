/**
 * The message a session's workflow sends the model after the operator decides on a gated tool
 * call. It is a real user turn in the transcript — that is what makes the model act on it — but
 * it is not something the operator typed, so the client renders it as a notice. The live turn
 * knows its origin structurally; a replayed transcript only has the text, hence the fixed prefix.
 */

export interface OperatorDecision {
  toolCallId: string;
  toolName: string;
  approved: boolean;
  comment?: string;
}

const PREFIX = "Operator decision:";

export const formatOperatorDecision = (
  decision: Pick<OperatorDecision, "toolName" | "approved" | "comment">
): string => {
  const said = decision.comment ? ` They said: ${decision.comment}` : "";
  return decision.approved
    ? `${PREFIX} approved \`${decision.toolName}\`.${said} Run it now.`
    : `${PREFIX} declined \`${decision.toolName}\`.${said} Do not retry it. Acknowledge and wait for further instructions.`;
};

export const isOperatorDecisionText = (text: string): boolean =>
  text.startsWith(PREFIX);
