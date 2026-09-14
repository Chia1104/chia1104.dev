import { describe, expect, it } from "vitest";

import { procedureOf } from "../src/utils/rpc.util";

describe("procedureOf", () => {
  it("names the procedure below the RPC mount", () => {
    expect(procedureOf("/api/v1/rpc/feeds/list")).toBe("feeds.list");
    expect(procedureOf("/api/v1/rpc/agent/sessions/chat")).toBe(
      "agent.sessions.chat"
    );
  });

  it("is undefined outside the mount", () => {
    expect(procedureOf("/api/v1/health")).toBeUndefined();
    expect(procedureOf("/api/v1/rpc")).toBeUndefined();
  });
});
