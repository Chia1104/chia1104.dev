"use client";

import { useState } from "react";

import {
  Button,
  Header,
  Kbd,
  ListBox,
  Tooltip,
  TooltipContent,
} from "@heroui/react";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useTranslations } from "next-intl";

import { CommandDialog, CommandInput } from "@chia/ui/cmd";
import { MotionThemeIcon, defaultThemeVariants } from "@chia/ui/theme";
import useTheme, { Theme } from "@chia/ui/utils/use-theme";

import { FeedSearch } from "@/components/commons/feed-search";
import { useRouter } from "@/libs/i18n/navigation";
import { Locale } from "@/libs/utils/i18n";
import contact from "@/shared/contact";
import routes from "@/shared/routes";
import { SITE_MODE_HOME, SiteMode } from "@/shared/site-mode";

/** The Mod+K palette: the current mode's pages, the way into the other modes, contact and theme. */
export const CommandMenu = ({
  mode,
  ...props
}: PartialK<PropsWithLocale, "locale"> & { mode: SiteMode }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  useHotkey("Mod+K", () => setOpen((open) => !open));
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const t = useTranslations("nav");
  const tRoutes = useTranslations("routes");
  const tMode = useTranslations("mode");
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
            locale={props.locale ?? Locale.ZhTW}
            onSelect={closeCommand}
          />
        ) : (
          <ListBox
            aria-label={t("search-placeholder")}
            className="max-h-[300px] overflow-y-auto">
            <ListBox.Section>
              <Header>{t("pages")}</Header>
              {Object.entries(routes[mode]).map(([path, { nameKey }]) => (
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
              <Header>{tMode("label")}</Header>
              {Object.values(SiteMode)
                .filter((value) => value !== mode)
                .map((value) => (
                  <ListBox.Item
                    key={value}
                    id={`mode-${value}`}
                    textValue={tMode(value)}
                    className="gap-5 px-2 py-2.5 text-sm"
                    onAction={() => {
                      router.push(SITE_MODE_HOME[value], {
                        locale: props.locale,
                      });
                      closeCommand();
                    }}>
                    <div className="i-mdi-swap-horizontal size-5" />
                    {tMode(value)}
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
                  <span className="flex size-5 items-center justify-center">
                    {icon}
                  </span>
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
                { value: Theme.System, label: t("theme-system") },
                { value: Theme.Dark, label: t("theme-dark") },
                { value: Theme.Light, label: t("theme-light") },
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
