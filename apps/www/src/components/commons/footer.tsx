"use client";

import type { FC } from "react";

import { Tabs, Tab, Button } from "@heroui/react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { Locale } from "next-intl";
import { useLocale } from "next-intl";
import { useSelectedLayoutSegments } from "next/navigation";

import meta from "@chia/meta";
import DateFormat from "@chia/ui/date-format";
import Image from "@chia/ui/image";
import Link from "@chia/ui/link";
import RetroGrid from "@chia/ui/retro-grid";
import ThemeSelector from "@chia/ui/theme";
import { cn } from "@chia/ui/utils/cn.util";

import CurrentPlaying from "@/components/commons/current-playing";
import LocaleSelector from "@/components/commons/locale-selector";
import contact from "@/shared/contact";
import navItems from "@/shared/routes";

import HugeThanks from "./huge-thanks";

const Copyright: FC<{ className?: string }> = ({ className }) => {
  const locale = useLocale();
  return (
    <span className={className}>
      © <DateFormat date={undefined} format="YYYY" locale={locale} />{" "}
      <span className="font-bold">{meta.name}</span>
    </span>
  );
};

/**
 * @TODO: Replace with canvas logo
 */
const Logo = () => (
  <Image
    src="https://pliosymjzzmsswrxbkih.supabase.co/storage/v1/object/public/public-assets/icon.png"
    alt="logo"
    width={60}
    height={60}
    loading="lazy"
  />
);

const Footer: FC<{ locale?: Locale }> = ({ locale }) => {
  const selectedLayoutSegments = useSelectedLayoutSegments();
  const t = useTranslations("theme");
  const tNav = useTranslations("nav");
  const tRoutes = useTranslations("routes");
  return (
    <RetroGrid
      data-testid="footer"
      className="c-bg-third relative flex min-h-[400px] flex-col items-center justify-center overflow-hidden py-20">
      <div className="container z-40 mb-10 flex w-full px-10 justify-between">
        <CurrentPlaying
          className="bg-white dark:bg-black"
          hoverCardContentClassName="bg-white/30 dark:bg-black/30 backdrop-blur-lg"
        />
        <div className="md:w-1/3 flex md:justify-start justify-end">
          <HugeThanks />
        </div>
      </div>
      <div className="container z-20 flex w-full px-10">
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
          />
          <Copyright className="mt-auto" />
        </div>
        <div className="flex w-1/2 flex-col items-start md:w-1/3">
          <p className="mb-3 ml-2 text-lg font-bold">{tNav("pages")}</p>
          <Tabs
            variant="light"
            aria-label="nav bar"
            className="w-fit"
            isVertical
            selectedKey={
              selectedLayoutSegments[0] === "(blog)"
                ? "posts"
                : (selectedLayoutSegments[0] ?? "/")
            }>
            {Object.entries(navItems).map(([path, { nameKey }]) => {
              return (
                <Tab
                  className="w-fit"
                  key={path.replace(/^\//, "")}
                  title={
                    <Link locale={locale} key={path} href={path}>
                      <span className="relative px-[10px] py-[5px]">
                        <p>{tRoutes(nameKey)}</p>
                      </span>
                    </Link>
                  }
                />
              );
            })}
          </Tabs>
        </div>
        <div className="flex w-1/2 flex-col items-start gap-1 md:w-1/3">
          <p className="mb-3 ml-2 text-lg font-bold">{tNav("contact")}</p>
          <div className="flex flex-col items-start gap-2">
            {Object.entries(contact).map(([_key, { name, icon, link }]) => (
              <Button
                size="sm"
                href={link}
                key={link}
                as={Link}
                variant="light"
                className="text-default-500 gap-1 text-start">
                {icon} {name}
              </Button>
            ))}
          </div>
        </div>
      </div>
      <div className="container z-20 mt-5 flex w-full items-center justify-between px-10 md:hidden">
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
