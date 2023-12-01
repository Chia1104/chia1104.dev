"use client";

import { useEffect } from "react";
import { getHTTPStatusCodeFromError } from "@trpc/server/http";
import { TRPCError } from "@trpc/server";

export default function Error({
  error,
}: {
  error?: Error & { digest?: string };
}) {
  useEffect(() => {
    if (error) {
      console.error(error);
    }
  }, [error]);
  if (error instanceof TRPCError) {
    const statusCode = getHTTPStatusCodeFromError(error);
    switch (statusCode) {
      case 403:
      case 401:
        return (
          <div className="c-container main">
            <div className="text-center">
              <h1 className="text-3xl font-bold">401</h1>
              <p className="text-xl font-bold">You are not logged in.</p>
            </div>
          </div>
        );
      default:
        return (
          <div className="c-container main">
            <div className="text-center">
              <h1 className="text-3xl font-bold">{statusCode}</h1>
              <p className="text-xl font-bold">Something went wrong.</p>
            </div>
          </div>
        );
    }
  }
  return (
    <div className="c-container main">
      <div className="text-center">
        <h1 className="text-3xl font-bold">500 - {error?.name}</h1>
        <p className="text-xl font-bold">
          {error?.digest ?? "Something went wrong."}
        </p>
      </div>
    </div>
  );
}
