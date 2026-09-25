"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import type { FC, ReactNode } from "react";

import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";

import meta from "@chia/meta";
import DateFormat from "@chia/ui/date-format";
import ThemeSelector from "@chia/ui/theme";
import { cn } from "@chia/ui/utils/cn.util";
import { Theme } from "@chia/ui/utils/use-theme";

import { LoadingSkeleton } from "@/components/commons/current-playing";
import { FooterLogotype } from "@/components/commons/footer-logotype";
import LocaleSelector from "@/components/commons/locale-selector";
import { Settings } from "@/components/commons/settings";
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
      <span className="font-medium">{meta.name}</span>
    </span>
  );
};

const FooterCell = ({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) => (
  <div className={cn("border-separator flex flex-col gap-3 p-4", className)}>
    <p className="text-muted text-xs font-medium">{label}</p>
    {children}
  </div>
);

/** Laid out as the title block of a drawing: labelled cells split by hairlines. */
const Footer: FC<{ locale?: Locale }> = ({ locale: _locale }) => {
  const t = useTranslations("theme");
  const tNav = useTranslations("nav");
  const tRoutes = useTranslations("routes");
  return (
    <footer data-testid="footer" className="overflow-x-clip px-2">
      <div className="border-separator mx-auto max-w-3xl border-x">
        <div className="rule-t rule-b">
          <div aria-hidden className="hatch-band h-12" />
        </div>
        <div className="rule-b page-sm:grid-cols-3 grid grid-cols-2">
          <FooterCell
            label={tNav("pages")}
            className="page-sm:border-b-0 border-r border-b">
            <ul className="flex flex-col gap-2 text-sm">
              {Object.entries(navItems).map(([path, { nameKey }]) => (
                <li key={path}>
                  <Link
                    href={path}
                    className="hover:text-foreground text-muted transition-colors">
                    {tRoutes(nameKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </FooterCell>
          <FooterCell
            label={tNav("contact")}
            className="page-sm:border-r page-sm:border-b-0 border-b">
            <ul className="flex flex-col gap-2 text-sm">
              {Object.values(contact).map(({ name, icon, link }) => (
                <li key={link}>
                  <Link
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground text-muted flex items-center gap-2 transition-colors">
                    {icon}
                    {name}
                  </Link>
                </li>
              ))}
            </ul>
          </FooterCell>
          <FooterCell
            label={t("label")}
            className="page-sm:col-span-1 col-span-2">
            <div className="flex flex-wrap items-center gap-2">
              <ThemeSelector
                enableCMD
                label={t("label")}
                themeLabel={{
                  [Theme.System]: t("system"),
                  [Theme.Dark]: t("dark"),
                  [Theme.Light]: t("light"),
                }}
                buttonProps={{
                  variant: "tertiary",
                }}
                dropdownProps={{
                  popover: {
                    className: "min-w-40",
                  },
                }}
              />
              <LocaleSelector />
              <Settings />
            </div>
          </FooterCell>
        </div>
        <div className="rule-b flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <CurrentPlaying
            experimental={{
              displayBackgroundColorFromImage: true,
            }}
          />
          <HugeThanks />
        </div>
        <div className="rule-b px-4 py-3">
          <Copyright className="text-muted text-sm" />
        </div>
        <FooterLogotype />
      </div>
    </footer>
  );
};

export default Footer;
