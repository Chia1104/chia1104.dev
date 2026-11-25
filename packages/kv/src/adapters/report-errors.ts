import type { Keyv } from "keyv";

import { reportError } from "@chia/observability/report";

/**
 * Reports every store failure. Without an `error` listener Keyv rejects failed calls and
 * throws connection errors raised outside a call, which ends the process; with one, a failed
 * read is a miss and a failed write returns `false`.
 */
export const reportKvErrors = <TKv extends Keyv>(kv: TKv): TKv => {
  kv.on("error", (error: Error) => {
    reportError(error, "KV store failed");
  });
  return kv;
};
