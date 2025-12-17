"use client";

import { useState } from "react";

import { HeroUIProvider as _HeroUIProvider } from "@heroui/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { RootProvider as FDProvider } from "fumadocs-ui/provider/next";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages, Timezone } from "next-intl";
import type { Locale } from "next-intl";
import { ThemeProvider } from "next-themes";
import { useRouter } from "next/navigation";

import { getQueryClient } from "@/libs/utils/query-client";

const HeroUIProvider = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  return (
    <_HeroUIProvider navigate={(...args) => router.push(...args)}>
      {children}
    </_HeroUIProvider>
  );
};

const RootProvider = ({
  children,
  messages,
  timeZone,
  locale,
}: {
  children: React.ReactNode;
  messages: AbstractIntlMessages;
  timeZone: Timezone;
  locale: Locale;
}) => {
  const [queryClient] = useState(() => getQueryClient());
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
            <QueryClientProvider client={queryClient}>
              {children}
            </QueryClientProvider>
          </FDProvider>
        </HeroUIProvider>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
};

export default RootProvider;
