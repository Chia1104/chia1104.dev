import { getLocale, getTranslations } from "next-intl/server";

import { FeedOrderBy, FeedType } from "@chia/db/types";
import { NavigationMenu, NavigationMenuList } from "@chia/ui/navigation-menu";

import FeedNavigation from "@/components/blog/feed-navigation";
import { Link } from "@/libs/i18n/navigation";
import { client } from "@/libs/orpc/client.rsc";
import { dbLocaleResolver } from "@/libs/utils/i18n";

export const revalidate = 300;

const Navigation = ({
  locale,
  tagsLabel,
}: {
  locale: PropsWithLocale["locale"];
  tagsLabel: string;
}) => {
  const dbLocale = dbLocaleResolver(locale);

  return (
    <div className="not-prose page-md:mb-10 z-20 mb-5 flex items-center gap-4">
      <NavigationMenu>
        <NavigationMenuList className="gap-3">
          <FeedNavigation
            feeds={client.feeds.list({
              limit: 4,
              withContent: false,
              orderBy: FeedOrderBy.CreatedAt,
              sortOrder: "desc",
              locale: dbLocale,
              type: FeedType.Post,
            })}
            type="post"
          />
          <FeedNavigation
            feeds={client.feeds.list({
              limit: 4,
              withContent: false,
              orderBy: FeedOrderBy.CreatedAt,
              sortOrder: "desc",
              locale: dbLocale,
              type: FeedType.Note,
            })}
            type="note"
          />
        </NavigationMenuList>
      </NavigationMenu>
      <Link
        href="/tags"
        className="text-foreground-700 hover:text-foreground text-sm no-underline transition-colors">
        {tagsLabel}
      </Link>
    </div>
  );
};

const Layout = async ({ children }: LayoutProps<"/[locale]">) => {
  const [locale, t] = await Promise.all([
    getLocale(),
    getTranslations("blog.tags"),
  ]);
  return (
    <section className="prose dark:prose-invert page-md:mt-20 mt-10 flex min-h-[calc(100vh-140px)] w-full min-w-full flex-col items-start justify-start">
      <div className="z-30">
        <Navigation locale={locale} tagsLabel={t("doc-title")} />
      </div>
      {children}
    </section>
  );
};

export default Layout;
