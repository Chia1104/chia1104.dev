import { cache } from "react";

import { createHydrationHelpers } from "@trpc/react-query/rsc";

import type { AppRouter } from "@chia/api/trpc";
import { createCaller, createTRPCContext } from "@chia/api/trpc";
import { auth } from "@chia/auth";
import { createRedis } from "@chia/cache";
import { getDB } from "@chia/db";

import { createQueryClient } from "@/utils/query-client";

/**
 * This wraps the `createTRPCContext` helper and provides the required context for the tRPC API when
 * handling a tRPC call from a React Server Component.
 */
const createContext = cache(async () => {
  return createTRPCContext({
    auth: await auth(),
    db: getDB(),
    redis: createRedis(),
  });
});

const getQueryClient = cache(createQueryClient);
const caller = createCaller(createContext);

export const { trpc: api, HydrateClient } = createHydrationHelpers<AppRouter>(
  caller,
  getQueryClient
);
