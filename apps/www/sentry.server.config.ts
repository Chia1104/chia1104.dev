import { init } from "@sentry/nextjs";

import { env } from "./src/env";

init({
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  enabled:
    ["production"].includes(env.NEXT_PUBLIC_ENV) &&
    env.NEXT_PUBLIC_ENABLE_SENTRY,
  environment: env.NEXT_PUBLIC_ENV,
});
