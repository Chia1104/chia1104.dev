import { implement } from "@orpc/server";
import { os } from "@orpc/server";
import type { ORPCError } from "@orpc/server";

import type { Session } from "@chia/auth/types";
import type { DB } from "@chia/db";
import type { Feed, Content } from "@chia/db/schema";
import type { Keyv } from "@chia/kv";

import { routerContract } from "./router.contract";

export interface BaseOSContext {
  headers: Headers;
  db: DB;
  redis: Keyv;
  hooks?: {
    onError?: (error: ORPCError<string, unknown>) => void;
    onUnauthorized?: (error: ORPCError<"UNAUTHORIZED", unknown>) => void;
    onForbidden?: (error: ORPCError<"FORBIDDEN", unknown>) => void;
    onFeedCreated?: (feed: Feed & { content: Content }) => Promise<void>;
    onFeedUpdated?: (feed: Feed & { content: Content | null }) => Promise<void>;
  };
  session?: Session | null;
}

export const baseOS = os.$context<BaseOSContext>();

export const contractOS = implement(routerContract).$context<BaseOSContext>();
