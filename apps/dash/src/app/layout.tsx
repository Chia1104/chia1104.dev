import type { ReactNode } from "react";

import type { Viewport, Metadata } from "next";
import { ViewTransitions } from "next-view-transitions";
import { headers } from "next/headers";

import { auth } from "@chia/auth";
import { getBaseUrl, DASH_BASE_URL } from "@chia/utils";

import "./globals.css";
import RootProvider from "./root-provider";

export const viewport: Viewport = {
  themeColor: "#2B2E4A",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(
    getBaseUrl({
      isServer: true,
      baseUrl: DASH_BASE_URL,
    })
  ),
  title: "Dashboard | Chia1104",
  description: "Chia1104's Dashboard",
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  return (
    <ViewTransitions>
      <html lang="en" suppressHydrationWarning>
        <body className="scrollbar-thin scrollbar-thumb-primary dark:scrollbar-thumb-secondary scrollbar-thumb-rounded-full overflow-x-hidden">
          <RootProvider session={session} headers={await headers()}>
            {children}
          </RootProvider>
        </body>
      </html>
    </ViewTransitions>
  );
}
