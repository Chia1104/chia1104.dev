import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import type { AppRouter, ExternalRouter } from "./root";
import { appRouter, externalRouter } from "./root";
import {
  createCallerFactory,
  createTRPCContext,
  external_createTRPCContext,
  external_createCallerFactory,
} from "./trpc";

/**
 * Create a server-side caller for the tRPC API
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
const createCaller = createCallerFactory(appRouter);
const external_createCaller = external_createCallerFactory(externalRouter);

/**
 * Inference helpers for input types
 * @example type HelloInput = RouterInputs['example']['hello']
 **/
export type RouterInputs = inferRouterInputs<AppRouter>;
export type ExternalRouterInputs = inferRouterInputs<ExternalRouter>;

/**
 * Inference helpers for output types
 * @example type HelloOutput = RouterOutputs['example']['hello']
 **/
export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type ExternalRouterOutputs = inferRouterOutputs<ExternalRouter>;

export { appRouter, type AppRouter, createCaller };
export { createTRPCContext, createCallerFactory };

export { feedsRouter } from "./routes/feeds";

export {
  externalRouter,
  type ExternalRouter,
  external_createCaller,
  external_createTRPCContext,
};
