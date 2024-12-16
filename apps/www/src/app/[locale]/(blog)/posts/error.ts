"use client";

import { captureException } from "@sentry/nextjs";

import Error from "@chia/ui/features/Error";

export default Error({
  onError(error) {
    captureException(error);
    console.error(error);
  },
  className: "w-full",
});
