import type { Metadata, Viewport } from "next";
import { getMessages, getTimeZone } from "next-intl/server";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import meta from "@chia/meta";
import { WWW_BASE_URL } from "@chia/utils/config";

import AppLayout from "@/components/commons/app-layout";
import AppPlugins from "@/components/commons/app-plugins";
import { CHBot } from "@/components/commons/ch-bot";
import RootLayout from "@/components/commons/root-layout";
import RootProvider from "@/components/commons/root-provider";
import { routing } from "@/libs/i18n/routing";
import { initDayjs } from "@/libs/utils/dayjs";

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
    keywords: [
      "Typescript",
      "FullStack",
      "NextJS",
      "React",
      "NestJS",
      "Chia1104",
    ],
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
  modal,
  params,
}: {
  children: ReactNode;
  modal: ReactNode;
  params: PageParamsWithLocale;
}) => {
  const locale = (await params).locale;
  if (!routing.locales.includes(locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  const timeZone = await getTimeZone();
  initDayjs(locale, timeZone);

  return (
    <RootLayout locale={locale}>
      <RootProvider messages={messages} timeZone={timeZone} locale={locale}>
        <AppLayout locale={locale}>
          {children}
          {modal}
          <CHBot
            wrapperProps={{ className: "fixed right-6 bottom-6 z-50 size-20" }}
            className="size-20 rounded-full shadow-[0px_0px_15px_4px_rgb(252_165_165/0.3)] transition-all dark:border-purple-400/50 dark:shadow-[0px_0px_15px_4px_RGB(192_132_252/0.3)]"
          />
        </AppLayout>
        <AppPlugins />
      </RootProvider>
    </RootLayout>
  );
};

export default Layout;
