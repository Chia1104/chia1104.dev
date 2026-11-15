import type { ReactNode } from "react";

import type { Locale } from "next-intl";

import { CommandMenu } from "@/components/commons/command-menu";
import { ModeSwitch } from "@/components/commons/mode-switch";
import { HobbyFooter } from "@/components/hobby/hobby-footer";
import { HobbyStage } from "@/components/hobby/hobby-stage";
import { Link } from "@/libs/i18n/navigation";
import { SITE_MODE_HOME, SiteMode } from "@/shared/site-mode";

/**
 * The hobby mode's frame: no header bar and no column, only the stage behind a page of type that
 * runs to the edges of the viewport. The portrait beside the wordmark is the way back to the tech
 * mode. `data-site-mode` is what `@chia/themes/hobby.css` and the reader palette key off;
 * `--hobby-gutter` is the one inset everything in the frame shares.
 */
const HobbyFrame = ({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) => (
  <div
    data-site-mode={SiteMode.Hobby}
    className="flex flex-1 flex-col [--hobby-gutter:clamp(1rem,3vw,3rem)]">
    <HobbyStage />
    <div className="flex w-fit items-center gap-3 px-(--hobby-gutter) pt-6 pb-[clamp(2.5rem,8vw,6rem)]">
      <ModeSwitch mode={SiteMode.Hobby} className="size-9 rounded-lg" />
      <Link
        href={SITE_MODE_HOME[SiteMode.Hobby]}
        className="focus-visible:ring-focus rounded-sm text-lg font-semibold tracking-tight outline-none focus-visible:ring-2">
        Chia1104
      </Link>
    </div>
    <main data-testid="main-content" className="flex flex-1 flex-col">
      {children}
    </main>
    <HobbyFooter />
    {/* What a header would hold, kept out of the way. No backdrop blur: the field redraws under it. */}
    <div
      data-testid="nav-menu"
      className="bg-background/85 fixed bottom-4 left-(--hobby-gutter) z-50 flex items-center gap-1 rounded-xl p-1">
      <CommandMenu locale={locale} mode={SiteMode.Hobby} />
    </div>
  </div>
);

export default HobbyFrame;
