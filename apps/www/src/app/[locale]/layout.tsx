import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { getLocale, getTranslations } from "next-intl/server";

import meta from "@chia/meta";
import { WWW_BASE_URL } from "@chia/utils/config";

import SiteShell from "@/components/commons/site-shell";
import { routing } from "@/libs/i18n/routing";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FECACA" },
    { media: "(prefers-color-scheme: dark)", color: "#2B2E4A" },
  ],
  colorScheme: "dark",
  width: "device-width",
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile");
  return {
    metadataBase: new URL(WWW_BASE_URL),
    title: {
      default: `${meta.name} | ${t("title")}`,
      template: `%s | ${meta.name}`,
    },
    description: t("bio"),
    creator: meta.name,
    icons: {
      icon: "/favicon.ico",
      shortcut: "/favicon.ico",
      apple: "/favicon.ico",
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

const Layout = async ({
  children,
}: {
  children: ReactNode;
  modal?: ReactNode;
}) => {
  const locale = await getLocale();
  return <SiteShell locale={locale}>{children}</SiteShell>;
};

export default Layout;
