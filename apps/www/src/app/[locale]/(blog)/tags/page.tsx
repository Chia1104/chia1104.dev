import type { Metadata } from "next";
import { ViewTransition } from "react";

import { getLocale, getTranslations } from "next-intl/server";

import { Link } from "@/libs/i18n/navigation";
import { client } from "@/libs/orpc/client.rsc";
import { dbLocaleResolver } from "@/libs/utils/i18n";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("blog.tags");
  return {
    title: t("doc-title"),
    description: t("description"),
  };
}

const Page = async () => {
  const [locale, t, { items }] = await Promise.all([
    getLocale(),
    getTranslations("blog.tags"),
    client.tags.list(),
  ]);
  const dbLocale = dbLocaleResolver(locale);
  const tags = items
    .filter((tag) => tag.feedCount > 0)
    .map((tag) => ({
      ...tag,
      name: tag.translations[dbLocale]?.name ?? tag.slug,
      description: tag.translations[dbLocale]?.description ?? null,
    }));

  return (
    <ViewTransition>
      <div className="w-full">
        <h1>{t("doc-title")}</h1>
        <p>{t("description")}</p>
        {tags.length === 0 ? (
          <p className="text-muted">{t("no-content")}</p>
        ) : (
          <ul className="not-prose page-md:grid-cols-2 m-0 grid list-none gap-3 p-0">
            {tags.map((tag) => (
              <li key={tag.id} className="m-0 p-0">
                <Link
                  href={`/tags/${tag.slug}`}
                  className="c-bg-third hover:bg-default block rounded-2xl p-4 no-underline transition-colors">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-base font-medium">{tag.name}</span>
                    <span className="text-muted shrink-0 text-xs">
                      {t("count", { count: tag.feedCount })}
                    </span>
                  </span>
                  {tag.description ? (
                    <span className="text-muted mt-1 line-clamp-2 block text-sm">
                      {tag.description}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ViewTransition>
  );
};

export default Page;
