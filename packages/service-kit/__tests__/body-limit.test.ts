import http from "node:http";

import { Hono } from "hono";
import { serve } from "srvx/node";

import { isAppError, toErrorResponse } from "../src/errors";
import { bodyLimit } from "../src/middlewares/body-limit";

/**
 * Runs through srvx, not `app.request()`: the failure this middleware exists to avoid
 * only reproduces with srvx's lazy `Request`, which is what Nitro's node server hands
 * Hono in production.
 */
const MAX = 64;
let server: ReturnType<typeof serve>;
let port: number;

const send = (headers: Record<string, string | number>, body: string) =>
  new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port, path: "/rpc/x", method: "POST", headers },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () =>
          resolve({ status: res.statusCode ?? 0, body: data })
        );
      }
    );
    req.on("error", reject);
    req.end(body);
  });

beforeAll(async () => {
  const app = new Hono();
  app.use(bodyLimit(MAX));
  // Mirrors `RPCHandler.handle(c.req.raw)`: the handler reads the raw request's body.
  app.post("/rpc/x", async (c) => {
    const text = await c.req.raw.text();
    return c.json({ len: text.length });
  });
  app.onError((error, c) =>
    isAppError(error)
      ? c.json(toErrorResponse(error), 413)
      : c.text(String(error), 500)
  );

  server = serve({ port: 0, fetch: app.fetch, silent: true });
  await server.ready();
  port = Number(new URL(server.url!).port);
});

afterAll(async () => {
  await server.close();
});

const small = JSON.stringify({ json: { a: 1 } });
const big = "x".repeat(MAX * 3);

describe("bodyLimit under srvx", () => {
  it("passes a declared body under the cap through untouched", async () => {
    const res = await send(
      { "content-length": Buffer.byteLength(small) },
      small
    );
    expect(res).toEqual({
      status: 200,
      body: JSON.stringify({ len: small.length }),
    });
  });

  it("refuses a declared body over the cap", async () => {
    const res = await send({ "content-length": Buffer.byteLength(big) }, big);
    expect(res.status).toBe(413);
  });

  it("passes a chunked body under the cap and the handler still reads it", async () => {
    const res = await send({ "transfer-encoding": "chunked" }, small);
    expect(res).toEqual({
      status: 200,
      body: JSON.stringify({ len: small.length }),
    });
  });

  it("refuses a chunked body over the cap", async () => {
    const res = await send({ "transfer-encoding": "chunked" }, big);
    expect(res.status).toBe(413);
  });
});
