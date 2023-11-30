"use client";

import { useEffect } from "react";

export default function Error({ error }: { error?: Error }) {
  useEffect(() => {
    if (error) {
      console.error(error);
    }
  }, [error]);
  switch (error?.message) {
    case "FORBIDDEN":
    case "UNAUTHORIZED":
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
            <h1 className="text-3xl font-bold">500</h1>
            <p className="text-xl font-bold">Something went wrong.</p>
          </div>
        </div>
      );
  }
}
