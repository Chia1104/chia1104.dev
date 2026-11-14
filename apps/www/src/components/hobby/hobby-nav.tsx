"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import type { FC } from "react";

import { useTranslations } from "next-intl";

import { ChatLauncher } from "@/components/agent/chat-launcher";
import { CommandMenu } from "@/components/commons/command-menu";
import { ModeSwitch } from "@/components/commons/mode-switch";
import { Link } from "@/libs/i18n/navigation";
import routes from "@/shared/routes";
import { SITE_MODE_HOME, SiteMode } from "@/shared/site-mode";

const HOME = SITE_MODE_HOME[SiteMode.Hobby];

const CATEGORY_LINK_CLASS_NAME =
  "text-muted/60 hover:text-foreground aria-[current]:text-foreground aria-[current]:decoration-accent focus-visible:ring-focus rounded-sm underline decoration-transparent decoration-4 underline-offset-8 transition-colors outline-none focus-visible:ring-2";

/** The hobby frame's header, and under it the categories set as the page's largest type. */
export const HobbyNav: FC<PropsWithLocale> = ({ locale }) => {
  const segment = useSelectedLayoutSegment();
  const t = useTranslations("hobby");
  const tRoutes = useTranslations("routes");
  return (
    <>
      <header className="bg-background/80 sticky top-0 z-50 backdrop-blur-md">
        <div
          data-testid="nav-menu"
          className="page-md:px-8 mx-auto flex h-(--header-height) w-full max-w-6xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-3">
            <Link
              href={HOME}
              scroll
              className="text-lg font-semibold tracking-tight">
              Chia1104
            </Link>
            <ModeSwitch mode={SiteMode.Hobby} />
          </div>
          <div className="flex items-center gap-2">
            <ChatLauncher />
            <CommandMenu locale={locale} mode={SiteMode.Hobby} />
          </div>
        </div>
      </header>
      <nav
        aria-label={t("nav")}
        className="page-md:px-8 mx-auto w-full max-w-6xl px-4 pt-10">
        <ul className="page-sm:text-3xl page-md:text-5xl page-md:gap-x-8 -mx-1 flex [scrollbar-width:none] gap-x-5 overflow-x-auto px-1 pb-4 text-2xl font-bold tracking-tight whitespace-nowrap">
          <li>
            <Link
              href={HOME}
              aria-current={segment === null ? "page" : undefined}
              className={CATEGORY_LINK_CLASS_NAME}>
              {t("all")}
            </Link>
          </li>
          {Object.entries(routes[SiteMode.Hobby]).map(([path, { nameKey }]) => (
            <li key={path}>
              <Link
                href={path}
                aria-current={
                  path === `${HOME}/${segment}` ? "page" : undefined
                }
                className={CATEGORY_LINK_CLASS_NAME}>
                {tRoutes(nameKey)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
};
