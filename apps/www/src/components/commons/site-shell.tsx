import "@total-typescript/ts-reset";
import "katex/dist/katex.css";
import "@/styles/globals.css";
import "react-medium-image-zoom/dist/styles.css";
import type { ReactNode } from "react";

import type { Locale } from "next-intl";
import { getMessages, getTimeZone } from "next-intl/server";

import AppLayout from "@/components/commons/app-layout";
import AppPlugins from "@/components/commons/app-plugins";
import { PaletteScript } from "@/components/commons/palette-script";
import RootLayout from "@/components/commons/root-layout";
import RootProvider from "@/components/commons/root-provider";
import { initDayjs } from "@/libs/utils/dayjs";

/**
 * The whole document for one locale. The locale is passed explicitly because `global-not-found`
 * renders outside the `[locale]` segment, where no root param resolves it.
 */
const SiteShell = async ({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) => {
  const [messages, timeZone] = await Promise.all([
    getMessages({ locale }),
    getTimeZone({ locale }),
  ]);
  initDayjs(locale, timeZone);

  return (
    <RootLayout locale={locale}>
      <PaletteScript />
      <RootProvider messages={messages} timeZone={timeZone} locale={locale}>
        <AppLayout locale={locale}>{children}</AppLayout>
        <AppPlugins />
      </RootProvider>
    </RootLayout>
  );
};

export default SiteShell;
