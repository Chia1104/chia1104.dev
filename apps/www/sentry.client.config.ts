import { init, replayIntegration } from "@sentry/nextjs";

import { env } from "./src/env";

init({
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  integrations: [replayIntegration()],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  enabled: ["production"].includes(env.NEXT_PUBLIC_ENV),
  environment: env.NEXT_PUBLIC_ENV,
  debug: env.NEXT_PUBLIC_ENV === "development",
});
