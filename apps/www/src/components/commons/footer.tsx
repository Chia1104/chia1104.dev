"use client";

import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSelectedLayoutSegments } from "next/navigation";
import type { FC } from "react";

import { Tabs, Button, Link as HeroLink } from "@heroui/react";
import { motion } from "motion/react";

import meta from "@chia/meta";
import DateFormat from "@chia/ui/date-format";
import Image from "@chia/ui/image";
import RetroGrid from "@chia/ui/retro-grid";
import ThemeSelector from "@chia/ui/theme";
import { cn } from "@chia/ui/utils/cn.util";

import { LoadingSkeleton } from "@/components/commons/current-playing";
import LocaleSelector from "@/components/commons/locale-selector";
import contact from "@/shared/contact";
import navItems from "@/shared/routes";

import HugeThanks from "./huge-thanks";

const CurrentPlaying = dynamic(
  () =>
    import("@/components/commons/current-playing").then(
      (mod) => mod.CurrentPlaying
    ),
  {
    ssr: false,
    loading: () => <LoadingSkeleton />,
  }
);

const Copyright: FC<{ className?: string }> = ({ className }) => {
  const locale = useLocale();
  return (
    <span className={className}>
      © <DateFormat date={undefined} format="YYYY" locale={locale} />{" "}
      <span className="font-bold">{meta.name}</span>
    </span>
  );
};

const Logo = () => (
  <Image
    src="https://storage.chia1104.dev/bot-example.png"
    alt="logo"
    width={60}
    height={60}
    loading="lazy"
  />
);

const Footer: FC<{ locale?: Locale }> = ({ locale: _locale }) => {
  const selectedLayoutSegments = useSelectedLayoutSegments();
  const t = useTranslations("theme");
  const tNav = useTranslations("nav");
  const tRoutes = useTranslations("routes");
  return (
    <RetroGrid
      data-testid="footer"
      className="c-bg-third relative flex min-h-[400px] flex-col items-center justify-center overflow-hidden py-20">
      <div className="z-40 container mb-10 flex w-full justify-between px-10">
        <CurrentPlaying
          className="bg-white dark:bg-black"
          hoverCardContentClassName="bg-white/30 dark:bg-black/30 backdrop-blur-lg"
        />
        <div className="flex justify-end md:w-1/3 md:justify-start">
          <HugeThanks />
        </div>
      </div>
      <div className="z-20 container flex w-full px-10">
        <div className="hidden h-full min-h-[130px] w-1/3 flex-col items-start gap-5 md:flex">
          <Logo />
          <LocaleSelector />
          <ThemeSelector
            enableCMD
            label={t("label")}
            themeLabel={{
              system: t("system"),
              dark: t("dark"),
              light: t("light"),
            }}
            buttonProps={{
              variant: "tertiary",
            }}
          />
          <Copyright className="mt-auto" />
        </div>
        <div className="flex w-1/2 flex-col items-start md:w-1/3">
          <p className="mb-3 ml-2 text-lg font-bold">{tNav("pages")}</p>
          <Tabs
            aria-label={tNav("pages")}
            className="w-fit"
            orientation="vertical"
            selectedKey={
              selectedLayoutSegments[0] === "(blog)"
                ? "posts"
                : (selectedLayoutSegments[0] ?? "/")
            }>
            <Tabs.ListContainer>
              <Tabs.List
                aria-label={tNav("pages")}
                className="gap-2 bg-transparent">
                {Object.entries(navItems).map(([path, { nameKey }]) => {
                  return (
                    <Tabs.Tab
                      key={path}
                      className="w-fit justify-start pl-1 before:h-0"
                      id={path.replace(/^\//, "")}>
                      <Link key={path} href={path}>
                        {tRoutes(nameKey)}
                      </Link>
                    </Tabs.Tab>
                  );
                })}
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
        </div>
        <div className="flex w-1/2 flex-col items-start gap-1 md:w-1/3">
          <p className="mb-3 ml-2 text-lg font-bold">{tNav("contact")}</p>
          <div className="flex flex-col items-start gap-2">
            {Object.entries(contact).map(([_key, { name, icon, link }]) => (
              <Button key={link} variant="ghost" size="sm">
                <Link
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-start">
                  {icon} {name} <HeroLink.Icon />
                </Link>
              </Button>
            ))}
          </div>
        </div>
      </div>
      <div className="z-20 container mt-5 flex w-full items-center justify-between px-10 md:hidden">
        <div className="flex items-center gap-3">
          <Logo />
          <LocaleSelector />
          <ThemeSelector
            label=""
            themeLabel={{
              system: t("system"),
              dark: t("dark"),
              light: t("light"),
            }}
            buttonProps={{
              variant: "tertiary",
            }}
          />
        </div>
        <Copyright />
      </div>
      <motion.div
        whileInView={{
          opacity: "50%",
        }}
        initial={{
          opacity: "0%",
        }}
        transition={{
          delay: 0.3,
          duration: 0.7,
        }}
        className={cn(
          "dark:c-bg-gradient-purple-to-pink c-bg-gradient-yellow-to-pink absolute -bottom-[300px] -z-40 h-[450px] w-full max-w-[850px] rounded-full blur-3xl"
        )}
      />
    </RetroGrid>
  );
};

export default Footer;
