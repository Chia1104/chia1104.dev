"use client";

import { useEffect, ViewTransition } from "react";

import { Button } from "@heroui/react";

import { ErrorBoundary } from "@chia/ui/error-boundary";

const Error = ({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) => {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ViewTransition>
      <ErrorBoundary>
        <div className="flex min-h-[400px] w-full flex-col items-center justify-center gap-4">
          <h2 className="text-2xl font-bold">Something went wrong!</h2>
          <p className="text-muted-foreground">
            {error.message || "Failed to load notes"}
          </p>
          <Button variant="primary" onPress={reset}>
            Try again
          </Button>
        </div>
      </ErrorBoundary>
    </ViewTransition>
  );
};

export default Error;
