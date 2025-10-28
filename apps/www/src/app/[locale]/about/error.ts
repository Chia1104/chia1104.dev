"use client";

import { captureException } from "@sentry/nextjs";

import ErrorComponent from "@chia/ui/features/Error";

export default ErrorComponent({
  onError(error) {
    captureException(error);
    console.error(error);
  },
});
