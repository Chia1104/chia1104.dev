"use client";

import type { FC, ReactNode } from "react";

import { HeroUIProvider } from "@heroui/react";
import { RootProvider as FDProvider } from "fumadocs-ui/provider";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages, Timezone } from "next-intl";
import { ThemeProvider } from "next-themes";
import { useRouter } from "next/navigation";

import { TRPCReactProvider } from "@/trpc/client";
import type { I18N } from "@/utils/i18n";

const RootProvider: FC<{
  children: ReactNode;
  headers?: Headers;
  messages: AbstractIntlMessages;
  timeZone: Timezone;
  locale: I18N;
}> = ({ children, headers, messages, timeZone, locale }) => {
  const router = useRouter();
  return (
    <NextIntlClientProvider
      messages={messages}
      timeZone={timeZone}
      locale={locale}>
      <ThemeProvider defaultTheme="system" enableSystem attribute="class">
        <HeroUIProvider navigate={void router.push}>
          <FDProvider
            search={{
              enabled: false,
            }}>
            <TRPCReactProvider headers={headers}>{children}</TRPCReactProvider>
          </FDProvider>
        </HeroUIProvider>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
};

export default RootProvider;
