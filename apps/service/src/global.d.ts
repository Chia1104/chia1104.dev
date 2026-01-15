type Variables = {
  db: import("@chia/db").DB;
  redis: import("@chia/kv").Keyv;
  AI_AUTH_TOKEN: string;
  user: import("@chia/auth/types").Session["user"] | null;
  session: import("@chia/auth/types").Session["session"] | null;
  clientIP: string;
};

type HonoContext = {
  Bindings: undefined;
  Variables: Variables;
};
