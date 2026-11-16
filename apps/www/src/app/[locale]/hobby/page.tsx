import type { Metadata } from "next";
import { ViewTransition } from "react";

import { getLocale, getTranslations } from "next-intl/server";

import { HobbyIndex } from "@/components/hobby/hobby-index";
import { localizedMetadata } from "@/libs/i18n/alternates";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t] = await Promise.all([
    getLocale(),
    getTranslations("hobby"),
  ]);
  return {
    title: t("title"),
    description: t("description"),
    ...localizedMetadata({ href: "/hobby", locale }),
  };
}

const Page = () => (
  <ViewTransition>
    <HobbyIndex />
  </ViewTransition>
);

export default Page;
