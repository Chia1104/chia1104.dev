import type { ReactNode } from "react";

import { GoogleTagManager } from "@next/third-parties/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import "@total-typescript/ts-reset";
import { Analytics as VercelAnalytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTimeZone } from "next-intl/server";
import { setRequestLocale } from "next-intl/server";
import { ViewTransitions } from "next-view-transitions";
import { notFound } from "next/navigation";
import "react-medium-image-zoom/dist/styles.css";

import meta from "@chia/meta";
import ScrollYProgress from "@chia/ui/scroll-y-progess";
import { WWW_BASE_URL } from "@chia/utils";

import { env } from "@/env";
import { routing } from "@/i18n/routing";
import { initDayjs } from "@/utils/dayjs";
import type { I18N } from "@/utils/i18n";

import "../../styles/globals.css";
import Background from "./_components/background";
import Footer from "./_components/footer";
import NavMenu from "./_components/nav-menu";
import RootProvider from "./_components/root-provider";
import { WebVitals } from "./_components/web-vitals";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FECACA" },
    { media: "(prefers-color-scheme: dark)", color: "#2B2E4A" },
  ],
  colorScheme: "dark",
  width: "device-width",
};

export const metadata: Metadata = {
  metadataBase: new URL(WWW_BASE_URL),
  title: {
    default: `${meta.name} | ${meta.title}`,
    template: `%s | ${meta.name}`,
  },
  description: meta.content,
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
  params: Promise<{ locale: I18N }>;
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
    <ViewTransitions>
      <html lang={locale} suppressHydrationWarning>
        <NextIntlClientProvider messages={messages} timeZone={timeZone}>
          <body className="scrollbar-thin dark:scrollbar-thumb-dark scrollbar-thumb-light scrollbar-thumb-rounded-full">
            <RootProvider>
              <Background />
              <NavMenu locale={locale} />
              <ScrollYProgress className="fixed top-0 z-[999]" />
              <main>
                {children}
                {modal}
              </main>
              <Footer locale={locale} />
            </RootProvider>
            {env.NEXT_PUBLIC_ENV === "production" && (
              <>
                <VercelAnalytics />
                <WebVitals />
                <GoogleTagManager gtmId={env.NEXT_PUBLIC_GTM_ID ?? ""} />
                <GoogleAnalytics gaId={env.NEXT_PUBLIC_GA_ID ?? ""} />
                <SpeedInsights />
              </>
            )}
          </body>
        </NextIntlClientProvider>
      </html>
    </ViewTransitions>
  );
};

export default Layout;
