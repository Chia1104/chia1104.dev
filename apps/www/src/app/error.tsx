"use client";

import { Image } from "@chia/ui";
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
    console.error(error);
  }, [error]);
  return (
    <main className="main c-container prose dark:prose-invert">
      <div className="c-bg-third relative flex min-h-[320px] w-full max-w-[700px] flex-col items-center justify-center overflow-hidden rounded-lg p-3 px-5">
        <h3 className="my-2">
          Here looks a little boring, I'll prepare it for you soon
        </h3>
        <div>
          <div className="not-prose aspect-h-1 aspect-w-1 relative w-[200px]">
            <Image
              src="/memo.png"
              alt="memo"
              className="object-cover"
              fill
              loading="lazy"
            />
          </div>
        </div>
        <div className="dark:c-bg-gradient-purple-to-pink c-bg-gradient-yellow-to-pink absolute -z-40 h-full w-full opacity-50 blur-3xl" />
      </div>
    </main>
  );
}
