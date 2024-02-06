import * as Sentry from "@sentry/nextjs";
import { env } from "./src/env";

Sentry.init({
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  integrations: [new Sentry.Replay()],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  enabled: ["production"].includes(env.NEXT_PUBLIC_ENV),
  environment: env.NEXT_PUBLIC_ENV,
});
