"use client";

import { useTranslations } from "next-intl";

import { PageDescription, PageTitle } from "@/components/commons/ruled";

const ContactHeader = () => {
  const t = useTranslations("contact");

  return (
    <header className="flex flex-col">
      <PageTitle>
        {t("title")}{" "}
        <span className="animate-cia-waving-hand inline-block origin-[70%_70%]">
          👋
        </span>
      </PageTitle>
      <PageDescription>{t("description")}</PageDescription>
    </header>
  );
};

export default ContactHeader;
