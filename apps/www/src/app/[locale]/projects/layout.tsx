import type { Metadata } from "next";
import { ViewTransition } from "react";
import type { ReactNode } from "react";

import { getTranslations } from "next-intl/server";

import { Band } from "@/components/commons/ruled";
import { PageHeader } from "@/components/project/page-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("projects");
  return {
    title: t("title"),
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
