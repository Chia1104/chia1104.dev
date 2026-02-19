import "@/libs/orpc/client.rsc";
import "./globals.css";
import type { Viewport, Metadata } from "next";
import type { ReactNode } from "react";

import { getBaseUrl, DASH_BASE_URL } from "@chia/utils/config";

import RootLayout from "@/components/commons/root-layout";

import RootProvider from "../components/commons/root-provider";

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

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <RootLayout>
      <RootProvider>{children}</RootProvider>
    </RootLayout>
  );
}
