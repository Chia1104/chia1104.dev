import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ViewTransition } from "react";

import Contact from "@/components/contact/contact";
import ContactHeader from "@/components/contact/contact-header";
import ContactLinks from "@/components/contact/contact-links";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("contact");
  return {
    title: t("contact-me"),
  };
}

const ContactPage = () => {
  return (
    <ViewTransition>
      <article className="prose dark:prose-invert mt-20 max-w-[700px] items-start">
        <ContactHeader />
        <ContactLinks />
        <Contact />
      </article>
    </ViewTransition>
  );
};

export default ContactPage;
