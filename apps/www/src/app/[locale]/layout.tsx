import type { ReactNode } from "react";

import { GoogleTagManager } from "@next/third-parties/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import "@total-typescript/ts-reset";
import { Analytics as VercelAnalytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTimeZone, getLocale } from "next-intl/server";
import { setRequestLocale } from "next-intl/server";
import { ViewTransitions } from "next-view-transitions";
import { notFound } from "next/navigation";
import "react-medium-image-zoom/dist/styles.css";

import meta from "@chia/meta";
import ScrollYProgress from "@chia/ui/scroll-y-progess";
import { WWW_BASE_URL } from "@chia/utils";

import Background from "@/components/commons/background";
import Footer from "@/components/commons/footer";
import NavMenu from "@/components/commons/nav-menu";
import RootLayout from "@/components/commons/root-layout";
import RootProvider from "@/components/commons/root-provider";
import { WebVitals } from "@/components/commons/web-vitals";
import { env } from "@/env";
import { routing } from "@/i18n/routing";
import "@/styles/globals.css";
import { initDayjs } from "@/utils/dayjs";
import type { I18N } from "@/utils/i18n";

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
}: {
  children: ReactNode;
  modal: ReactNode;
}) => {
  const locale = (await getLocale()) as I18N;
  if (!routing.locales.includes(locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  const timeZone = await getTimeZone();

  initDayjs(locale, timeZone);

  return (
    <ViewTransitions>
      <RootLayout locale={locale}>
        <NextIntlClientProvider messages={messages} timeZone={timeZone}>
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
        </NextIntlClientProvider>
      </RootLayout>
    </ViewTransitions>
  );
};

export default Layout;
