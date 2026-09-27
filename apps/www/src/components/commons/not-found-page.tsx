"use client";

import { buttonVariants } from "@heroui/styles";
import { useTranslations } from "next-intl";

import { StatusSheet } from "@/components/commons/status";
import { Link } from "@/libs/i18n/navigation";

/**
 * Reads its messages from the client provider: `global-not-found` renders outside `[locale]`, where
 * the server request config has no root param to resolve a locale from.
 */
const NotFoundPage = () => {
  const t = useTranslations("status");
  return (
    <StatusSheet
      glyphs={["4", "0", "4"]}
      title={t("notFound.title")}
      description={t("notFound.description")}>
      <Link href="/" className={buttonVariants({ variant: "primary" })}>
        {t("home")}
      </Link>
      <Link href="/posts" className={buttonVariants({ variant: "tertiary" })}>
        {t("notFound.posts")}
      </Link>
    </StatusSheet>
  );
};

export default NotFoundPage;
