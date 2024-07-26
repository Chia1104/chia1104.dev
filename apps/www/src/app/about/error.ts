"use client";

import * as Sentry from "@sentry/nextjs";

import { Features } from "@chia/ui";

export default Features.Error({
  onError(error) {
    Sentry.captureException(error);
    console.error(error);
  },
});
