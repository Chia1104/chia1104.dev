import { app } from "../../src/server";

export const rpc = (path: string, input?: unknown) =>
  app.request(`/api/v1/rpc/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ json: input }),
  });
