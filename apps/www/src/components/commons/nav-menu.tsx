"use client";

import Link from "next/link";
import { useSelectedLayoutSegments } from "next/navigation";
import { useState } from "react";
import type { FC } from "react";

import {
  Button,
  Header,
  Kbd,
  ListBox,
  Tooltip,
  TooltipContent,
  Tabs,
} from "@heroui/react";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useTranslations } from "next-intl";

import { CommandDialog, CommandInput } from "@chia/ui/cmd";
import { Theme, MotionThemeIcon, defaultThemeVariants } from "@chia/ui/theme";
import useTheme from "@chia/ui/utils/use-theme";

import { FeedSearch } from "@/components/commons/feed-search";
import { useRouter } from "@/libs/i18n/navigation";
import { Locale } from "@/libs/utils/i18n";
import contact from "@/shared/contact";
import navItems from "@/shared/routes";

const CMDK = (props: PartialK<PropsWithLocale, "locale">) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  useHotkey("Mod+K", () => setOpen((open) => !open));
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const t = useTranslations("nav");
  const tRoutes = useTranslations("routes");
  const closeCommand = () => {
    setQuery("");
    setOpen(false);
  };
  return (
    <>
      <Tooltip>
        <Button
          size="sm"
          variant="tertiary"
          onClick={() => setOpen(true)}
          aria-label="CMD"
          isIconOnly>
          <div className="i-mdi-hamburger size-4" />
        </Button>
        <TooltipContent>
          <Kbd>
            <Kbd.Abbr keyValue="command" />
            <Kbd.Content>K</Kbd.Content>
          </Kbd>
        </TooltipContent>
      </Tooltip>
      <CommandDialog
        aria-label={t("search-placeholder")}
        isOpen={open}
        onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (!isOpen) {
            setQuery("");
          }
        }}
        inputValue={query}
        onInputChange={setQuery}>
        <CommandInput placeholder={t("search-placeholder")} />
        {query.trim().length >= 2 ? (
          <FeedSearch
            query={query}
            locale={props.locale ?? Locale.ZH_TW}
            onSelect={closeCommand}
          />
        ) : (
          <ListBox
            aria-label={t("search-placeholder")}
            className="max-h-[300px] overflow-y-auto">
            <ListBox.Section>
              <Header>{t("pages")}</Header>
              {Object.entries(navItems).map(([path, { nameKey }]) => (
                <ListBox.Item
                  key={path}
                  id={path}
                  textValue={tRoutes(nameKey)}
                  className="gap-5 px-2 py-2.5 text-sm"
                  onAction={() => {
                    router.push(path, { locale: props.locale });
                    closeCommand();
                  }}>
                  <div className="i-mdi-paper size-5" />
                  {tRoutes(nameKey)}
                </ListBox.Item>
              ))}
            </ListBox.Section>
            <ListBox.Section>
              <Header className="flex items-center justify-between">
                <p>{t("contact")}</p>
              </Header>
              {Object.entries(contact).map(([key, { name, icon, link }]) => (
                <ListBox.Item
                  key={key}
                  id={key}
                  textValue={name}
                  className="gap-5 px-2 py-2.5 text-sm"
                  onAction={() => {
                    window.open(link, "_blank");
                    closeCommand();
                  }}>
                  {icon}
                  {name}
                </ListBox.Item>
              ))}
            </ListBox.Section>
            <ListBox.Section>
              <Header className="flex items-center justify-between">
                <p>{t("theme", { theme: theme ?? "-" })}</p>
                <Kbd className="text-xs">
                  <Kbd.Abbr keyValue="command" />
                  <Kbd.Content>J</Kbd.Content>
                </Kbd>
              </Header>
              {[
                { value: Theme.SYSTEM, label: t("theme-system") },
                { value: Theme.DARK, label: t("theme-dark") },
                { value: Theme.LIGHT, label: t("theme-light") },
              ].map(({ value, label }) => (
                <ListBox.Item
                  key={value}
                  id={`theme-${value}`}
                  textValue={label}
                  className="gap-5 px-2 py-2.5 text-sm"
                  onAction={() => {
                    setTheme(value);
                    closeCommand();
                  }}>
                  <MotionThemeIcon
                    theme={value}
                    variants={defaultThemeVariants}
                  />
                  {label}
                </ListBox.Item>
              ))}
            </ListBox.Section>
          </ListBox>
        )}
      </CommandDialog>
    </>
  );
};

const NavMenu: FC<PropsWithLocale> = (props) => {
  const selectedLayoutSegments = useSelectedLayoutSegments();
  const tRoutes = useTranslations("routes");
  return (
    <nav
      data-testid="nav-menu"
      className="c-bg-third fixed top-0 right-(--dock-width,0px) left-0 z-50 flex h-15.75 items-center justify-center transition-[right] duration-200 ease-out motion-reduce:transition-none [html[data-dock-resizing]_&]:transition-none">
      <div className="container flex w-full justify-between px-5">
        <div className="flex w-1/5 items-center text-xl font-semibold tracking-tight">
          <Link
            href="/"
            scroll
            className="subtitle hover:c-text-green-to-purple ml-3 transition ease-in-out">
            Chia1104
          </Link>
        </div>
        <div className="flex w-fit items-center">
          <Tabs
            aria-label="nav bar"
            className="mx-4 w-fit"
            selectedKey={
              selectedLayoutSegments[0] === "(blog)"
                ? "posts"
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
          <CMDK locale={props.locale} />
        </div>
      </div>
    </nav>
  );
};

export default NavMenu;
