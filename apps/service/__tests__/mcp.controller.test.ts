import { beforeEach, describe, expect, it } from "vitest";

import { app } from "../src/server";

import * as guardMocks from "./helpers/guards";

const MCP = "/api/v1/mcp";

const initialize = () =>
  app.request(MCP, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test", version: "0.0.0" },
      },
    }),
  });

describe("mcp route", () => {
  beforeEach(() => {
    guardMocks.resetAllGuardMocks();
  });

  it("answers the MCP handshake for the operator", async () => {
    const response = await initialize();
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('"name":"chia1104.dev"');
  });

  it("refuses anyone the operator guard rejects", async () => {
    guardMocks.setOperatorDenied(true);
    const response = await initialize();
    expect(response.status).toBe(401);
  });
});
