import type { ReactNode } from "react";

import type { Locale } from "next-intl";

import { HobbyFooter } from "@/components/hobby/hobby-footer";
import { HobbyNav } from "@/components/hobby/hobby-nav";
import { SiteMode } from "@/shared/site-mode";

/**
 * The hobby mode's frame: a wide page with no rails, where cover art sets the structure.
 * `data-site-mode` is what `@chia/themes/hobby.css` and the reader palette key off.
 */
const HobbyFrame = ({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) => (
  <div data-site-mode={SiteMode.Hobby} className="flex flex-1 flex-col">
    <HobbyNav locale={locale} />
    <main
      data-testid="main-content"
      className="page-md:px-8 mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pt-6">
      {children}
    </main>
    <HobbyFooter />
  </div>
);

export default HobbyFrame;
