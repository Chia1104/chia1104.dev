"use client";

import { useTranslations } from "next-intl";

import { PageDescription, PageTitle } from "@/components/commons/ruled";

export const PageHeader = () => {
  const t = useTranslations("projects");
  return (
    <header className="flex flex-col">
      <PageTitle>{t("title")}</PageTitle>
      <PageDescription>{t("description")}</PageDescription>
    </header>
  );
};
