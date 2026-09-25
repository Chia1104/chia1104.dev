"use client";

import { captureException } from "@sentry/nextjs";
import { useTranslations } from "next-intl";

import { withError } from "@chia/ui/hoc/with-error";
import Image from "@chia/ui/image";

import { Panel } from "@/components/commons/ruled";

const ErrorContent = () => {
  const t = useTranslations("common");
  return (
    <Panel className="flex flex-col items-center gap-4 px-4 py-16 text-center">
      <h2 className="text-xl font-semibold">{t("error")}</h2>
      <div className="relative aspect-square w-[200px]">
        <Image
          src="https://storage.chia1104.dev/memo.png"
          alt="memo"
          className="object-cover"
          fill
          sizes="200px"
          loading="lazy"
        />
      </div>
    </Panel>
  );
};

const ErrorPage = withError(ErrorContent, {
  onError(error) {
    captureException(error);
    console.error(error);
  },
});

export default ErrorPage;
