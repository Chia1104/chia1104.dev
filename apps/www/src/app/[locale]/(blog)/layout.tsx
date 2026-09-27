import { NavigationMenu, NavigationMenuList } from "@chia/ui/navigation-menu";

import FeedNavigation from "@/components/blog/feed-navigation";
import TagNavigation from "@/components/blog/tag-navigation";
import { Band } from "@/components/commons/ruled";

const Layout = ({ children }: LayoutProps<"/[locale]">) => (
  <section className="flex w-full flex-1 flex-col">
    <div className="rule-t rule-b flex items-center px-2 py-1.5">
      <NavigationMenu>
        <NavigationMenuList className="gap-3">
          <FeedNavigation type="post" />
          <FeedNavigation type="note" />
          <TagNavigation />
        </NavigationMenuList>
      </NavigationMenu>
    </div>
    <Band />
    {children}
  </section>
);

export default Layout;
