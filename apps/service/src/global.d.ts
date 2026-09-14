type Variables = import("@chia/service-kit/context").ServiceContext & {
  /** The oRPC procedure this request matched, for the request log. */
  rpcProcedure?: string;
};

type HonoContext<
  TBindings = undefined,
  TVariables extends object = Variables,
> = {
  Bindings: TBindings;
  Variables: TVariables;
};
