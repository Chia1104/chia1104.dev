import type { ORPCError } from "@orpc/server";
import { implement } from "@orpc/server";
import { os } from "@orpc/server";
import GithubSlugger from "github-slugger";

import type { AuthGateway } from "@chia/auth/gateway";
import type { Session } from "@chia/auth/types";
import type { DB } from "@chia/db";
import type { Keyv } from "@chia/kv";

import { routerContract } from "./router.contract";

export interface BaseOSContext {
  headers: Headers;
  db: DB;
  kv?: Keyv;
  auth?: AuthGateway;
  hooks?: {
    onError?: (error: ORPCError<string, unknown>) => void;
    onUnauthorized?: (error: ORPCError<"UNAUTHORIZED", unknown>) => void;
    onForbidden?: (error: ORPCError<"FORBIDDEN", unknown>) => void;
    onFeedChanged?: (feedID: number) => Promise<void>;
    onFeedRemoved?: (translationIDs: readonly number[]) => Promise<void>;
  };
  session?: Session | null;
}

export const baseOS = os.$context<BaseOSContext>();

export const contractOS = implement(routerContract).$context<BaseOSContext>();

export const slugger = new GithubSlugger();

export { withMetaSchema } from "./contracts/shared";
