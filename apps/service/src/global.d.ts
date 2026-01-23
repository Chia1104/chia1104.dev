type Variables = {
  db: import("@chia/db").DB;
  kv: import("@chia/kv").Keyv;
  clientIP: string;
  auth: import("@chia/auth").Auth;
};

type HonoContext<
  TBindings = undefined,
  TVariables extends object = Variables,
> = {
  Bindings: TBindings;
  Variables: TVariables;
};
