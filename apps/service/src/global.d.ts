type Bindings = import("@/env").ENV;

type Variables = {
  db: import("@chia/db").DB;
  redis: import("@chia/cache").Redis;
  AI_AUTH_TOKEN: string;
  user: typeof import("@chia/auth-core").auth.$Infer.Session.user | null;
  session: typeof import("@chia/auth-core").auth.$Infer.Session.session | null;
};

type HonoContext = {
  Bindings: Bindings;
  Variables: Variables;
};
