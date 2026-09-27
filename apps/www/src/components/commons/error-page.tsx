"use client";

import { Button } from "@heroui/react";
import { buttonVariants } from "@heroui/styles";
import { captureException } from "@sentry/nextjs";
import { useTranslations } from "next-intl";

import { withError } from "@chia/ui/hoc/with-error";

import { StatusSheet } from "@/components/commons/status";
import { Link } from "@/libs/i18n/navigation";

const ErrorContent = ({ reset }: { reset: () => void }) => {
  const t = useTranslations("status");
  return (
    <StatusSheet
      glyphs={["E", "R", "R", "O", "R"]}
      title={t("error.title")}
      description={t("error.description")}>
      <Button onPress={reset}>{t("error.retry")}</Button>
      <Link href="/" className={buttonVariants({ variant: "tertiary" })}>
        {t("home")}
      </Link>
    </StatusSheet>
  );
};

/** The error boundary of every localized route; it reports the error once it mounts. */
const ErrorPage = withError(ErrorContent, {
  onError(error) {
    captureException(error);
    console.error(error);
  },
});

export default ErrorPage;
