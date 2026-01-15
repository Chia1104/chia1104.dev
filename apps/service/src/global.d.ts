type Variables = {
  db: import("@chia/db").DB;
  kv: import("@chia/kv").Keyv;
  // redis: import("redis").RedisClientType | null;
  clientIP: string;
};

type HonoContext<
  TBindings = undefined,
  TVariables extends object = Variables,
> = {
  Bindings: TBindings;
  Variables: TVariables;
};
