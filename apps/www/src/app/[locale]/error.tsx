"use client";

import { useTranslations } from "next-intl";

import { withError } from "@chia/ui/hoc/with-error";
import Image from "@chia/ui/image";

const ErrorContent = () => {
  const t = useTranslations("common");
  return (
    <main className="main prose dark:prose-invert container">
      <div className="c-bg-third relative flex min-h-[320px] w-full max-w-[700px] flex-col items-center justify-center overflow-hidden rounded-lg p-3 px-5">
        <h3 className="my-2">{t("error")}</h3>
        <div>
          <div className="not-prose relative aspect-square w-[200px]">
            <Image
              src="https://storage.chia1104.dev/memo.png"
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
};

const ErrorPage = withError(ErrorContent, {
  onError(error) {
    // captureException(error);
    console.error(error);
  },
});

export default ErrorPage;
