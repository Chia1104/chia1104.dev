import type { Locale } from "@chia/db/types";
import { NavigationMenu, NavigationMenuList } from "@chia/ui/navigation-menu";

import FeedNavigation from "@/components/blog/feed-navigation";
import { dbLocaleResolver } from "@/libs/utils/i18n";
import { getPosts, getNotes } from "@/services/feeds.service";

export const revalidate = 300;

const Navigation = async ({ locale }: { locale: Locale }) => {
  return (
    <NavigationMenu className="not-prose z-20 mb-5 md:mb-10">
      <NavigationMenuList className="gap-5">
        <FeedNavigation feeds={getPosts(4, locale)} type="post" />
        <FeedNavigation feeds={getNotes(4, locale)} type="note" />
      </NavigationMenuList>
    </NavigationMenu>
  );
};

const Layout = async ({ children, params }: LayoutProps<"/[locale]">) => {
  const { locale } = await params;
  return (
    <section className="prose dark:prose-invert mt-10 flex min-h-[calc(100vh-140px)] w-full min-w-full flex-col items-start justify-start md:mt-20">
      <div className="z-30">
        <Navigation locale={dbLocaleResolver(locale)} />
      </div>
      {children}
    </section>
  );
};

export default Layout;
