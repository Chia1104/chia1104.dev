import type { Metadata } from "next";
import { ViewTransition } from "react";
import type { ReactNode } from "react";

import { getLocale, getTranslations } from "next-intl/server";

import { Band } from "@/components/commons/ruled";
import { PageHeader } from "@/components/project/page-header";
import { localizedMetadata } from "@/libs/i18n/alternates";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t] = await Promise.all([
    getLocale(),
    getTranslations("projects"),
  ]);
  return {
    title: t("title"),
    description: t("description"),
    ...localizedMetadata({ href: "/projects", locale }),
  };
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <ViewTransition>
      <article className="flex w-full min-w-0 flex-col">
        <PageHeader />
        <Band />
        {children}
      </article>
    </ViewTransition>
  );
}
