import { getLocale, getTranslations } from "next-intl/server";

import { FeedOrderBy, FeedType } from "@chia/db/types";
import DateFormat from "@chia/ui/date-format";
import { cn } from "@chia/ui/utils/cn.util";

import {
  Band,
  CELL_LINK_CLASS_NAME,
  LinkHatch,
  Panel,
  PanelDescription,
  PanelHeader,
  PanelTitle,
  RULED_CELL_CLASS_NAME,
  RuledGridFiller,
} from "@/components/commons/ruled";
import { Link } from "@/libs/i18n/navigation";
import { client } from "@/libs/orpc/client.rsc";
import { dbLocaleResolver } from "@/libs/utils/i18n";

/** Server-rendered so the home page links to recent writing without script. */
export async function LatestFeeds() {
  const [locale, t, tBlog] = await Promise.all([
    getLocale(),
    getTranslations("home.latest"),
    getTranslations("blog"),
  ]);
  const { items } = await client.feeds.list({
    limit: 4,
    type: FeedType.All,
    orderBy: FeedOrderBy.CreatedAt,
    sortOrder: "desc",
    withContent: false,
    locale: dbLocaleResolver(locale),
    translated: true,
  });
  const feeds = items.flatMap((feed) => {
    const [translation] = feed.translations;
    return translation ? [{ ...feed, translation }] : [];
  });
  if (feeds.length === 0) return null;

  return (
    <>
      <Band />
      <Panel>
        <PanelHeader>
          <div className="flex items-baseline justify-between gap-4">
            <PanelTitle>{t("title")}</PanelTitle>
            <Link href="/posts" className="link shrink-0 text-sm">
              {tBlog("posts.view-all")}
            </Link>
          </div>
          <PanelDescription>{t("description")}</PanelDescription>
        </PanelHeader>
        <ul className="page-md:grid-cols-2 grid">
          {feeds.map(({ translation, ...feed }) => {
            return (
              <li key={feed.id} className={RULED_CELL_CLASS_NAME}>
                <Link
                  href={`/${feed.type}s/${feed.slug}`}
                  className={cn(CELL_LINK_CLASS_NAME, "block px-4 py-3")}>
                  <LinkHatch />
                  <span className="text-muted flex items-center gap-2 text-xs tabular-nums">
                    <DateFormat
                      date={feed.createdAt}
                      format="MMM D, YYYY"
                      locale={locale}
                    />
                    <span aria-hidden>·</span>
                    {tBlog(`${feed.type}s.doc-title`)}
                  </span>
                  <span className="mt-1 block text-base font-medium">
                    {translation.title}
                  </span>
                  {translation.description ? (
                    <span className="text-muted mt-1 line-clamp-2 block text-sm">
                      {translation.description}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
          <RuledGridFiller count={feeds.length} />
        </ul>
      </Panel>
    </>
  );
}
