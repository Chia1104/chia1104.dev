import type { ORPCError } from "@orpc/server";
import { implement } from "@orpc/server";
import { os } from "@orpc/server";
import GithubSlugger from "github-slugger";

import type { Auth } from "@chia/auth";
import type { Session } from "@chia/auth/types";
import type { DB } from "@chia/db";
import type { Feed, Content, FeedTranslation } from "@chia/db/schema";
import type { Keyv } from "@chia/kv";

import { routerContract } from "./router.contract";

export interface BaseOSContext {
  headers: Headers;
  db: DB;
  kv: Keyv;
  auth: Auth;
  hooks?: {
    onError?: (error: ORPCError<string, unknown>) => void;
    onUnauthorized?: (error: ORPCError<"UNAUTHORIZED", unknown>) => void;
    onForbidden?: (error: ORPCError<"FORBIDDEN", unknown>) => void;
    onFeedCreated?: (
      feed: Feed & {
        translation: FeedTranslation;
        content: Content | undefined | null;
      }
    ) => Promise<void>;
    onFeedUpdated?: (
      feed: Feed & {
        translation: FeedTranslation | null | undefined;
        content: Content | null | undefined;
      }
    ) => Promise<void>;
  };
  session?: Session | null;
}

export const baseOS = os.$context<BaseOSContext>();

export const contractOS = implement(routerContract).$context<BaseOSContext>();

export const slugger = new GithubSlugger();
