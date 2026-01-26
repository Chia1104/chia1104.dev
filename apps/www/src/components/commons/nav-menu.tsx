"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useSelectedLayoutSegments } from "next/navigation";
import type { FC } from "react";

import { Button, Kbd, Tooltip, TooltipContent, Tabs } from "@heroui/react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  useCMD,
} from "@chia/ui/cmd";
import { Theme, MotionThemeIcon, defaultThemeVariants } from "@chia/ui/theme";
import useTheme from "@chia/ui/utils/use-theme";

import { useRouter } from "@/libs/i18n/routing";
import contact from "@/shared/contact";
import navItems from "@/shared/routes";

const CMDK = (props: PartialK<PropsWithLocale, "locale">) => {
  const [open, setOpen] = useCMD();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const t = useTranslations("nav");
  const tRoutes = useTranslations("routes");
  return (
    <>
      <Tooltip>
        <Button
          size="sm"
          variant="tertiary"
          onClick={() => setOpen(true)}
          aria-label="CMD"
          isIconOnly
          className="rounded-xl">
          <div className="i-mdi-hamburger size-4" />
        </Button>
        <TooltipContent>
          <Kbd>
            <Kbd.Abbr keyValue="command" />
            <Kbd.Content>K</Kbd.Content>
          </Kbd>
        </TooltipContent>
      </Tooltip>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder={t("search-placeholder")} />
        <CommandList>
          <CommandEmpty>{t("no-results")}</CommandEmpty>
          <CommandGroup heading={t("pages")}>
            {Object.entries(navItems).map(([path, { nameKey }]) => {
              return (
                <CommandItem
                  aria-label={tRoutes(nameKey)}
                  className="gap-5"
                  key={path}
                  onSelect={() => {
                    router.push(path, { locale: props.locale });
                    setOpen(false);
                  }}>
                  <div className="i-mdi-paper size-5" />
                  {tRoutes(nameKey)}
                </CommandItem>
              );
            })}
          </CommandGroup>
          <CommandSeparator className="mb-2" />
          <CommandGroup
            heading={
              <span className="flex items-center justify-between">
                <p>{t("contact")}</p>
                <Kbd className="text-xs">
                  <Kbd.Abbr keyValue="command" />
                  <Kbd.Content>I</Kbd.Content>
                </Kbd>
              </span>
            }>
            {Object.entries(contact).map(([key, { name, icon, link }]) => (
              <CommandItem
                className="gap-5"
                key={key}
                onSelect={() => {
                  window.open(link, "_blank");
                  setOpen(false);
                }}>
                {icon}
                {name}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator className="mb-2" />
          <CommandGroup
            heading={
              <span className="flex items-center justify-between">
                <p>{t("theme", { theme: theme ?? "-" })}</p>
                <Kbd className="text-xs">
                  <Kbd.Abbr keyValue="command" />
                  <Kbd.Content>J</Kbd.Content>
                </Kbd>
              </span>
            }>
            <CommandItem
              defaultChecked={theme === Theme.SYSTEM}
              className="gap-5"
              onSelect={() => {
                setTheme(Theme.SYSTEM);
                setOpen(false);
              }}>
              <MotionThemeIcon
                theme={Theme.SYSTEM}
                variants={defaultThemeVariants}
              />
              {t("theme-system")}
            </CommandItem>
            <CommandItem
              defaultChecked={theme === Theme.DARK}
              className="gap-5"
              onSelect={() => {
                setTheme(Theme.DARK);
                setOpen(false);
              }}>
              <MotionThemeIcon
                theme={Theme.DARK}
                variants={defaultThemeVariants}
              />
              {t("theme-dark")}
            </CommandItem>
            <CommandItem
              defaultChecked={theme === Theme.LIGHT}
              className="gap-5"
              onSelect={() => {
                setTheme(Theme.LIGHT);
                setOpen(false);
              }}>
              <MotionThemeIcon
                theme={Theme.LIGHT}
                variants={defaultThemeVariants}
              />
              {t("theme-light")}
            </CommandItem>
          </CommandGroup>
        </CommandList>
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
      className="c-bg-third fixed top-0 z-50 flex h-[75px] w-screen items-center justify-center">
      <div className="container flex w-full justify-between px-5">
        <div className="flex w-1/5 items-center text-2xl">
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
            <Tabs.ListContainer>
              <Tabs.List aria-label="nav bar" className="bg-transparent">
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
                            <p className="hidden md:block">
                              {tRoutes(nameKey)}
                            </p>
                            <div className="block md:hidden">{icon}</div>
                          </span>
                        </Link>
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
