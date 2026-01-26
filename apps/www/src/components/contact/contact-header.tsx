"use client";

import { useTranslations } from "next-intl";

const ContactHeader = () => {
  const t = useTranslations("contact");

  return (
    <>
      <h1>
        {t("title")}{" "}
        <span className="animate-cia-waving-hand inline-block origin-[70%_70%]">
          👋
        </span>
      </h1>
      <p>{t("description")}</p>
      <h3>{t("find-me-on")}</h3>
    </>
  );
};

export default ContactHeader;
