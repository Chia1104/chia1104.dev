"use client";

import { useSelectedLayoutSegments } from "next/navigation";
import type { FC } from "react";

import { Tabs } from "@heroui/react";
import { useTranslations } from "next-intl";

import { ChatLauncher } from "@/components/agent/chat-launcher";
import { CommandMenu } from "@/components/commons/command-menu";
import { ModeSwitch } from "@/components/commons/mode-switch";
import { Link } from "@/libs/i18n/navigation";
import routes from "@/shared/routes";
import { SiteMode } from "@/shared/site-mode";

const navItems = routes[SiteMode.Tech];

const NavMenu: FC<PropsWithLocale> = (props) => {
  const selectedLayoutSegments = useSelectedLayoutSegments();
  const tRoutes = useTranslations("routes");
  return (
    <header className="bg-background/80 sticky top-0 z-50 overflow-x-clip px-2 backdrop-blur-md">
      <nav
        data-testid="nav-menu"
        className="rule-b border-separator mx-auto flex h-(--header-height) w-full max-w-3xl items-center justify-between gap-2 border-x pr-2 pl-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            scroll
            className="hover:c-text-green-to-purple text-lg font-semibold tracking-tight transition ease-in-out">
            Chia1104
          </Link>
          {/* Narrower pages have no room beside the tabs; the footer carries the switch there. */}
          <ModeSwitch mode={SiteMode.Tech} className="page-sm:flex hidden" />
        </div>
        <div className="flex items-center gap-2">
          <Tabs
            aria-label="nav bar"
            className="w-fit"
            selectedKey={
              selectedLayoutSegments[0] === "(blog)"
                ? selectedLayoutSegments[1] === "notes"
                  ? "notes"
                  : "posts"
                : (selectedLayoutSegments[0] ?? "/")
            }>
            <Tabs.ListContainer className="bg-transparent">
              <Tabs.List aria-label="nav bar">
                {Object.entries(navItems).map(
                  ([path, { nameKey, icon, hiddenInMainMenu }]) => {
                    if (hiddenInMainMenu) return null;
                    const pathKey = path.replace(/^\//, "") || "home";
                    return (
                      <Tabs.Tab
                        key={pathKey}
                        id={pathKey}
                        data-testid={`nav-tab-${pathKey}`}
                        className="w-fit justify-start before:h-0">
                        <Link
                          key={path}
                          href={path}
                          aria-label={tRoutes(nameKey)}
                          data-testid={`nav-link-${pathKey}`}>
                          <span className="relative px-[10px] py-[5px]">
                            <p className="page-md:block hidden">
                              {tRoutes(nameKey)}
                            </p>
                            <div className="page-md:hidden block">{icon}</div>
                          </span>
                        </Link>
                        <Tabs.Indicator />
                      </Tabs.Tab>
                    );
                  }
                )}
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
          <span aria-hidden className="bg-separator h-5 w-px" />
          <ChatLauncher />
          <CommandMenu locale={props.locale} mode={SiteMode.Tech} />
        </div>
      </nav>
    </header>
  );
};

export default NavMenu;
