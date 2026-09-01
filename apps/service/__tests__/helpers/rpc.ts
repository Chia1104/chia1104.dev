import { createORPCClient, ORPCError } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterContractClient } from "@orpc/contract";

import type { routerContract } from "@chia/api/orpc/contracts";

import { app } from "../../src/server";

const RPC_PREFIX = "/api/v1/rpc";

const link = new RPCLink({
  url: RPC_PREFIX as `/${string}`,
  fetch: async (url, init) => app.request(url, init),
});

export const client: RouterContractClient<typeof routerContract> =
  createORPCClient(link);

export const errorCode = (error: unknown): string | undefined =>
  error instanceof ORPCError ? error.code : undefined;

/** Path-only POST with the RPC envelope. Segments are encoded the same way as RPCLink. */
export const rpc = (path: string, input?: unknown) => {
  const encoded = path
    .split("/")
    .filter((segment) => segment.length > 0)
    .map(encodeURIComponent)
    .join("/");

  return app.request(`${RPC_PREFIX}/${encoded}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ json: input }),
  });
};
