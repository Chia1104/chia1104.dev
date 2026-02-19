import type { Metadata } from "next";
import { ViewTransition } from "react";
import type { ReactNode } from "react";

import { getTranslations } from "next-intl/server";

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
      <article className="prose dark:prose-invert mt-20 min-w-full">
        <PageHeader />
        {children}
      </article>
    </ViewTransition>
  );
}
