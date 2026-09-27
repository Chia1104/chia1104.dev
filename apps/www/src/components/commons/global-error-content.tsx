"use client";

import type { ComponentProps } from "react";

import { NextIntlClientProvider } from "next-intl";

import messages from "@chia/i18n/www/zh-TW.json";

import ErrorPage from "@/components/commons/error-page";
import { routing } from "@/libs/i18n/routing";

/** The error page with the default locale's catalog, which it brings along since no layout provided one. */
const GlobalErrorContent = (props: ComponentProps<typeof ErrorPage>) => (
  <NextIntlClientProvider locale={routing.defaultLocale} messages={messages}>
    <ErrorPage {...props} />
  </NextIntlClientProvider>
);

export default GlobalErrorContent;
