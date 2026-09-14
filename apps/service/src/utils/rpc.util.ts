/** Where `RPCHandler` is mounted; a request path below it names the procedure. */
export const RPC_PREFIX = "/api/v1/rpc";

/**
 * `feeds.list` for `/api/v1/rpc/feeds/list`, matching the `rpc.method` oRPC's own spans
 * carry; undefined outside the RPC mount.
 */
export const procedureOf = (path: string): string | undefined =>
  path.startsWith(`${RPC_PREFIX}/`)
    ? path.slice(RPC_PREFIX.length + 1).replaceAll("/", ".")
    : undefined;
