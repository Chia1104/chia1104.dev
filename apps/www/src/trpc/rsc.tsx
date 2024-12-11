import { cache } from "react";

import { createHydrationHelpers } from "@trpc/react-query/rsc";

import type { ExternalRouter } from "@chia/api/trpc";
import {
  external_createCaller,
  external_createTRPCContext,
} from "@chia/api/trpc";

import { env } from "@/env";
import { createQueryClient } from "@/utils/query-client";

/**
 * This wraps the `createTRPCContext` helper and provides the required context for the tRPC API when
 * handling a tRPC call from a React Server Component.
 */
const createContext = cache(() => {
  return external_createTRPCContext({
    internal_requestSecret: env.INTERNAL_REQUEST_SECRET,
  });
});

const getQueryClient = cache(createQueryClient);
const caller = external_createCaller(createContext);

export const { trpc: api, HydrateClient } =
  createHydrationHelpers<ExternalRouter>(caller, getQueryClient);
