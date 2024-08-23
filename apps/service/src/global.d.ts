type Bindings = import("@/env").ENV;

type Variables = {
  db: import("@chia/db").DB;
  AI_AUTH_TOKEN: string;
};

type HonoContext = {
  Bindings: Bindings;
  Variables: Variables;
};
