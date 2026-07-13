import { NavigationMenu, NavigationMenuList } from "@chia/ui/navigation-menu";

import FeedNavigation from "@/components/blog/feed-navigation";
import { FeedSearchDialog } from "@/components/blog/feed-search-dialog";
import { dbLocaleResolver } from "@/libs/utils/i18n";
import { getPosts, getNotes } from "@/services/feeds.service";

export const revalidate = 300;

const Navigation = ({ locale }: { locale: PropsWithLocale["locale"] }) => {
  const dbLocale = dbLocaleResolver(locale);

  return (
    <div className="not-prose z-20 mb-5 flex items-center gap-4 md:mb-10">
      <NavigationMenu>
        <NavigationMenuList className="gap-5">
          <FeedNavigation feeds={getPosts(4, dbLocale)} type="post" />
          <FeedNavigation feeds={getNotes(4, dbLocale)} type="note" />
        </NavigationMenuList>
      </NavigationMenu>
      <FeedSearchDialog locale={locale} />
    </div>
  );
};

const Layout = async ({ children, params }: LayoutProps<"/[locale]">) => {
  const { locale } = await params;
  return (
    <section className="prose dark:prose-invert mt-10 flex min-h-[calc(100vh-140px)] w-full min-w-full flex-col items-start justify-start md:mt-20">
      <div className="z-30">
        <Navigation locale={locale as PropsWithLocale["locale"]} />
      </div>
      {children}
    </section>
  );
};

export default Layout;
