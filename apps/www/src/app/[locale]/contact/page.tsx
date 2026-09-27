import type { Metadata } from "next";
import { ViewTransition } from "react";

import { getLocale, getTranslations } from "next-intl/server";

import { Band } from "@/components/commons/ruled";
import Contact from "@/components/contact/contact";
import ContactHeader from "@/components/contact/contact-header";
import { localizedMetadata } from "@/libs/i18n/alternates";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t] = await Promise.all([
    getLocale(),
    getTranslations("contact"),
  ]);
  return {
    title: t("contact-me"),
    description: t("description"),
    ...localizedMetadata({ href: "/contact", locale }),
  };
}

const ContactPage = () => {
  return (
    <ViewTransition>
      <article className="flex w-full flex-col">
        <ContactHeader />
        <Band />
        <Contact />
      </article>
    </ViewTransition>
  );
};

export default ContactPage;
