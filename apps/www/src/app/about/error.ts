"use client";

import { Features } from "@chia/ui";
import * as Sentry from "@sentry/nextjs";

export default Features.Error({
  onError(error) {
    Sentry.captureException(error);
    console.error(error);
  },
});
