type Bindings = import("@/env").ENV;

type Variables = {
  db: import("@chia/db").DB;
  redis: import("@chia/kv").Keyv;
  AI_AUTH_TOKEN: string;
  user: import("@chia/auth/types").Session["user"] | null;
  session: import("@chia/auth/types").Session["session"] | null;
  clientIP: string;
};

type HonoContext = {
  Bindings: Bindings;
  Variables: Variables;
};
