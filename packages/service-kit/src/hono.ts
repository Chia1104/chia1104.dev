import type { ServiceContext } from "./context";

/**
 * Hono env for a service app. `Variables` is {@link ServiceContext}, so the oRPC
 * handler mounts with `context: { ...c.var }`.
 */
// oxlint-disable-next-line typescript/consistent-type-definitions
export type ServiceHonoEnv<
  TVariables extends object = ServiceContext,
  TBindings = undefined,
> = {
  Bindings: TBindings;
  Variables: TVariables;
};
