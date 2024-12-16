"use client";

import { captureException } from "@sentry/nextjs";

import { withError } from "@chia/ui/hoc/with-error";
import Image from "@chia/ui/image";

const Error = withError(
  () => {
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
          <div className="dark:c-bg-gradient-purple-to-pink c-bg-gradient-yellow-to-pink absolute -z-40 size-full opacity-50 blur-3xl" />
        </div>
      </main>
    );
  },
  {
    onError(error) {
      captureException(error);
      console.error(error);
    },
  }
);

export default Error;
