import "zod/compile";
import { getWritable } from "workflow";

import type { AgentAbortMessage } from "@chia/agent-host/execution";

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
