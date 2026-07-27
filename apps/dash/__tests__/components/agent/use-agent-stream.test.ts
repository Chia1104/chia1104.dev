import type { AgentWireEvent } from "@chia/agent-core";

import { consumeAgentStream } from "@/components/agent/use-agent-stream";

const events = [
  { type: "run:start", sessionId: "session-1" },
  { type: "user", messageId: "message-1", text: "Draft an outline" },
  { type: "run:end", reason: "done" },
] satisfies AgentWireEvent[];

async function* eventStream() {
  for (const event of events) yield event;
}

describe("consumeAgentStream", () => {
  it("delivers durable events in order", async () => {
    const received: AgentWireEvent[] = [];

    await consumeAgentStream(eventStream(), (event) => received.push(event));

    expect(received).toEqual(events);
  });
});
