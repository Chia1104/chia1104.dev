import * as Sentry from "@sentry/nextjs";
import { env } from "./src/env.mjs";

Sentry.init({
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  enabled: ["production"].includes(env.NEXT_PUBLIC_ENV),
  environment: env.NODE_ENV,
});
