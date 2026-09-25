import { getLocale } from "next-intl/server";

import { FeedOrderBy, FeedType } from "@chia/db/types";
import { NavigationMenu, NavigationMenuList } from "@chia/ui/navigation-menu";

import FeedNavigation from "@/components/blog/feed-navigation";
import TagNavigation from "@/components/blog/tag-navigation";
import { Band } from "@/components/commons/ruled";
import { client } from "@/libs/orpc/client.rsc";
import { dbLocaleResolver } from "@/libs/utils/i18n";

export const revalidate = 300;

const Navigation = ({ locale }: { locale: PropsWithLocale["locale"] }) => {
  const dbLocale = dbLocaleResolver(locale);

  return (
    <div className="rule-t rule-b flex items-center px-2 py-1.5">
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
          <TagNavigation tags={client.tags.list()} locale={dbLocale} />
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  );
};

const Layout = async ({ children }: LayoutProps<"/[locale]">) => {
  const locale = await getLocale();
  return (
    <section className="flex w-full flex-1 flex-col">
      <Navigation locale={locale} />
      <Band />
      {children}
    </section>
  );
};

export default Layout;
