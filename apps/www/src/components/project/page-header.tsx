"use client";

import { useTranslations } from "next-intl";

export const PageHeader = () => {
  const t = useTranslations("projects");
  return (
    <header className="prose dark:prose-invert min-w-full">
      <h1>{t("title")}</h1>
      <p>{t("description")}</p>
    </header>
  );
};
