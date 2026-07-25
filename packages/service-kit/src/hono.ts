import type { ServiceContext } from "./context";

/**
 * Hono env for a service app. `Variables` is {@link ServiceContext} itself, which is
 * what lets the oRPC handler be mounted with `context: { ...c.var }`.
 *
 * `TVariables` is only widened by middleware that adds request-scoped values (e.g.
 * the AI guard's decoded token).
 */
// oxlint-disable-next-line typescript/consistent-type-definitions
export type ServiceHonoEnv<
  TVariables extends object = ServiceContext,
  TBindings = undefined,
> = {
  Bindings: TBindings;
  Variables: TVariables;
};
