import { cache } from "react";

import { createHydrationHelpers } from "@trpc/react-query/rsc";
import { headers } from "next/headers";
import "server-only";

import type { AppRouter } from "@chia/api/trpc";
import { createCaller, createTRPCContext } from "@chia/api/trpc";
import { authClient } from "@chia/auth/client";
import { connectDatabase } from "@chia/db/client";
import { kv } from "@chia/kv";

import { createQueryClient } from "@/utils/query-client";

/**
 * This wraps the `createTRPCContext` helper and provides the required context for the tRPC API when
 * handling a tRPC call from a React Server Component.
 */
const createContext = cache(async () => {
  return createTRPCContext({
    headers: await headers(),
    session:
      (
        await authClient.getSession({
          fetchOptions: {
            headers: await headers(),
          },
        })
      ).data ?? null,
    db: await connectDatabase(),
    redis: kv,
  });
});

const getQueryClient = cache(createQueryClient);
const caller = createCaller(createContext);

export const { trpc: api, HydrateClient } = createHydrationHelpers<AppRouter>(
  caller,
  getQueryClient
);
