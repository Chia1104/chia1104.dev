import "./globals.css";
import type { ReactNode } from "react";
import { auth } from "@chia/auth";
import RootProvider from "./root-provider";
import { headers } from "next/headers";
import type { Viewport, Metadata } from "next";
import { getBaseUrl, DASH_BASE_URL } from "@chia/utils";

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
    <html lang="en" suppressHydrationWarning>
      <body className="scrollbar-thin scrollbar-thumb-primary dark:scrollbar-thumb-secondary scrollbar-thumb-rounded-full overflow-x-hidden">
        <RootProvider session={session} headers={headers()}>
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
