import type { Metadata } from "next";
import { ViewTransition } from "react";

import { getTranslations } from "next-intl/server";

import { Band } from "@/components/commons/ruled";
import Contact from "@/components/contact/contact";
import ContactHeader from "@/components/contact/contact-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("contact");
  return {
    title: t("contact-me"),
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
