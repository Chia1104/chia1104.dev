import "./globals.css";
import type { ReactNode } from "react";
import { getServerSession } from "@chia/auth";
import RootProvider from "./root-provider";
import { headers } from "next/headers";
import type { Viewport, Metadata } from "next";
import { getBaseUrl } from "@/utils/getBaseUrl";

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
  const session = await getServerSession();
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
