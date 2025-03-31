import type { ReactNode } from "react";

import type { Viewport, Metadata } from "next";
import { headers } from "next/headers";

import { getBaseUrl, DASH_BASE_URL } from "@chia/utils";

import Background from "@/components/commons/background";
import RootLayout from "@/components/commons/root-layout";

import RootProvider from "../components/commons/root-provider";
import "./globals.css";

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

export default async function Layout({ children }: { children: ReactNode }) {
  return (
    <RootLayout>
      <RootProvider headers={await headers()}>
        <Background />
        {children}
      </RootProvider>
    </RootLayout>
  );
}
