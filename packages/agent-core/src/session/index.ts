export { PgSessionStorage, toPgSession } from "./pg-storage.ts";
export type { PgSessionMetadata } from "./pg-storage.ts";
export {
  PgSessionRepo,
  readSessionSettings,
  writeSessionSettings,
} from "./pg-repo.ts";
export type {
  PgSessionCreateOptions,
  PgSessionListOptions,
} from "./pg-repo.ts";
export {
  InMemoryPendingMessageStore,
  PgPendingMessageStore,
} from "./pg-pending-messages.ts";

/**
 * Re-exported so callers never import pi directly — see the package doc comment on why pi's 0.x
 * churn is contained to this package.
 */
export {
  InMemorySessionRepo,
  InMemorySessionStorage,
  Session,
  uuidv7,
} from "@earendil-works/pi-agent-core";
export type { SessionTreeEntry } from "@earendil-works/pi-agent-core";
