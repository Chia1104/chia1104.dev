"use client";

import { GoogleTagManager } from "@next/third-parties/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { Analytics as VercelAnalytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster as ST } from "sonner";

import { useCMD } from "@chia/ui/cmd";
import Cursor from "@chia/ui/cursor";
import type { Theme } from "@chia/ui/theme";
import useTheme from "@chia/ui/utils/use-theme";

import { WebVitals } from "@/components/commons/web-vitals";
import { env } from "@/env";
import { useRouter } from "@/i18n/routing";

const ContactCMD = () => {
  const router = useRouter();
  useCMD(false, {
    cmd: "i",
    onKeyDown: () => {
      router.push("/email");
    },
  });
  return null;
};

const Toaster = () => {
  const { theme } = useTheme();
  return <ST theme={theme as Theme} position="bottom-left" richColors />;
};

const AppPlugins = () => {
  return (
    <>
      <Toaster />
      <Cursor
        style={{
          opacity: 0.13,
          filter: "blur(50px)",
        }}
      />
      <ContactCMD />
      {env.NEXT_PUBLIC_ENV === "production" && (
        <>
          <VercelAnalytics />
          <WebVitals />
          <GoogleTagManager gtmId={env.NEXT_PUBLIC_GTM_ID ?? ""} />
          <GoogleAnalytics gaId={env.NEXT_PUBLIC_GA_ID ?? ""} />
          <SpeedInsights />
        </>
      )}
    </>
  );
};

export default AppPlugins;
