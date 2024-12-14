"use client";

import { useEffect } from "react";
import type { FC } from "react";

type NextError = Error & { digest?: string };

export const withError = (
  Component: FC<{
    error: NextError;
    reset: () => void;
  }>,
  options?: {
    onError?: (error: NextError) => void;
  }
) => {
  return function ErrorWrapper(props: { error: NextError; reset: () => void }) {
    useEffect(() => {
      if (props.error && options?.onError) {
        options.onError(props.error);
      }
    }, [props.error]);
    return <Component {...props} />;
  };
};
