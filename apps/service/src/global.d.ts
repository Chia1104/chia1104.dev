type Bindings = import("@/env").ENV;

type Variables = {
  db: import("@chia/db").DB;
};

type HonoContext = {
  Bindings: Bindings;
  Variables: Variables;
};
