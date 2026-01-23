import type { ReactNode } from "react";

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("projects");
  return {
    title: t("title"),
  };
}

export default async function Layout({ children }: { children: ReactNode }) {
  const t = await getTranslations("projects");
  return (
    <article className="prose dark:prose-invert mt-20 min-w-full">
      <h1>{t("title")}</h1>
      <p>{t("description")}</p>
      {children}
    </article>
  );
}
