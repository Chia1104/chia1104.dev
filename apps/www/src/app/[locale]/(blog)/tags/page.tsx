import type { Metadata } from "next";
import { ViewTransition } from "react";

import { getLocale, getTranslations } from "next-intl/server";

import { cn } from "@chia/ui/utils/cn.util";

import {
  CELL_LINK_CLASS_NAME,
  LinkHatch,
  PageDescription,
  PageTitle,
  RULED_CELL_CLASS_NAME,
  RuledGridFiller,
} from "@/components/commons/ruled";
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
      <div className="flex w-full flex-col">
        <PageTitle>{t("doc-title")}</PageTitle>
        <PageDescription>{t("description")}</PageDescription>
        {tags.length === 0 ? (
          <p className="rule-b hatch border-separator text-muted border-b px-4 py-12 text-center">
            {t("no-content")}
          </p>
        ) : (
          <ul className="rule-b page-md:grid-cols-2 grid">
            {tags.map((tag) => (
              <li key={tag.id} className={RULED_CELL_CLASS_NAME}>
                <Link
                  href={`/tags/${tag.slug}`}
                  className={cn(CELL_LINK_CLASS_NAME, "block px-4 py-3")}>
                  <LinkHatch />
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-base font-medium">{tag.name}</span>
                    <span className="text-muted shrink-0 text-xs tabular-nums">
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
            <RuledGridFiller count={tags.length} />
          </ul>
        )}
      </div>
    </ViewTransition>
  );
};

export default Page;
