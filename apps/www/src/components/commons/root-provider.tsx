"use client";

import { useState } from "react";

import { QueryClientProvider } from "@tanstack/react-query";
import { RootProvider as FDProvider } from "fumadocs-ui/provider/next";
import type { AbstractIntlMessages, Timezone } from "next-intl";
import type { Locale } from "next-intl";
import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "next-themes";

import { getQueryClient } from "@/libs/utils/query-client";

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
      </ThemeProvider>
    </NextIntlClientProvider>
  );
};

export default RootProvider;
