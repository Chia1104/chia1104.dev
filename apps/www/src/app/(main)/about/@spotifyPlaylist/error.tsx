"use client";

import { Image, ImageZoom } from "@chia/ui";
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function Error({
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
    <div className="c-bg-third relative flex min-h-[320px] w-full flex-col items-center justify-center overflow-hidden rounded-lg p-3 px-5">
      <h3 className="my-2">
        Here looks a little boring, I'll prepare it for you soon
      </h3>
      <ImageZoom>
        <div className="not-prose aspect-h-1 aspect-w-1 relative w-[200px]">
          <Image
            src="/memo.png"
            alt="memo"
            className="object-cover"
            fill
            loading="lazy"
          />
        </div>
      </ImageZoom>
      <div className="dark:c-bg-gradient-purple-to-pink c-bg-gradient-yellow-to-pink absolute -z-40 h-full w-full opacity-50 blur-3xl" />
    </div>
  );
}
