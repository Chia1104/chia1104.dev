import { getLocale } from "next-intl/server";

import { FeedOrderBy, FeedType } from "@chia/db/types";
import { NavigationMenu, NavigationMenuList } from "@chia/ui/navigation-menu";

import FeedNavigation from "@/components/blog/feed-navigation";
import { FeedSearchDialog } from "@/components/blog/feed-search-dialog";
import { client } from "@/libs/orpc/client.rsc";
import { dbLocaleResolver } from "@/libs/utils/i18n";

export const revalidate = 300;

const Navigation = ({ locale }: { locale: PropsWithLocale["locale"] }) => {
  const dbLocale = dbLocaleResolver(locale);

  return (
    <div className="not-prose z-20 mb-5 flex items-center gap-4 md:mb-10">
      <NavigationMenu>
        <NavigationMenuList className="gap-5">
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
      <FeedSearchDialog locale={locale} />
    </div>
  );
};

const Layout = async ({ children }: LayoutProps<"/[locale]">) => {
  const locale = await getLocale();
  return (
    <section className="prose dark:prose-invert mt-10 flex min-h-[calc(100vh-140px)] w-full min-w-full flex-col items-start justify-start md:mt-20">
      <div className="z-30">
        <Navigation locale={locale} />
      </div>
      {children}
    </section>
  );
};

export default Layout;
