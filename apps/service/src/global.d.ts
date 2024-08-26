type Bindings = import("@/env").ENV;

type Variables = {
  db: import("@chia/db").DB;
  redis: import("@chia/cache").Redis;
  AI_AUTH_TOKEN: string;
};

type HonoContext = {
  Bindings: Bindings;
  Variables: Variables;
};
