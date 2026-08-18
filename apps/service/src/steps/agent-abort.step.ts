import { getWritable } from "workflow";

/** The one message an abort controller's stream ever carries. */
export interface AgentAbortMessage {
  type: "abort";
  reason: string;
  /** Set when the controller reached its TTL rather than being resumed; readers ignore it. */
  expired: boolean;
}

/** Writes the abort message and closes the controller's stream, so every reader wakes and ends. */
export const writeAgentAbortStep = async (
  message: AgentAbortMessage
): Promise<void> => {
  "use step";

  const writable = getWritable<AgentAbortMessage>();
  const writer = writable.getWriter();
  try {
    await writer.write(message);
  } finally {
    writer.releaseLock();
  }
  await writable.close();
};
