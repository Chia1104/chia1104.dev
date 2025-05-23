"use client";

import type { FC, ReactNode } from "react";

import { HeroUIProvider as _HeroUIProvider } from "@heroui/react";
import { RootProvider as FDProvider } from "fumadocs-ui/provider";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages, Timezone } from "next-intl";
import type { Locale } from "next-intl";
import { ThemeProvider } from "next-themes";
import { useRouter } from "next/navigation";

import { TRPCReactProvider } from "@/trpc/client";

const HeroUIProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  return (
    <_HeroUIProvider navigate={(...args) => router.push(...args)}>
      {children}
    </_HeroUIProvider>
  );
};

const RootProvider: FC<{
  children: ReactNode;
  headers?: Headers;
  messages: AbstractIntlMessages;
  timeZone: Timezone;
  locale: Locale;
}> = ({ children, headers, messages, timeZone, locale }) => {
  return (
    <NextIntlClientProvider
      messages={messages}
      timeZone={timeZone}
      locale={locale}>
      <ThemeProvider defaultTheme="system" enableSystem attribute="class">
        <HeroUIProvider>
          <FDProvider
            theme={{
              enabled: true,
            }}
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
