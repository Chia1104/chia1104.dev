type Variables = {
  db: import("@chia/db").DB;
  redis: import("@chia/kv").Keyv;
  clientIP: string;
};

type HonoContext<
  TBindings = undefined,
  TVariables extends object = Variables,
> = {
  Bindings: TBindings;
  Variables: TVariables;
};
