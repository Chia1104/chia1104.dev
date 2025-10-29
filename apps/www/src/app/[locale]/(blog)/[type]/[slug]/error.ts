"use client";

import ErrorPage from "@chia/ui/features/Error";

export default ErrorPage({
  onError(error) {
    // captureException(error);
    console.error(error);
  },
  className: "w-full",
});
