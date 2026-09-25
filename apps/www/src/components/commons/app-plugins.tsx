"use client";

import { GoogleTagManager } from "@next/third-parties/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { Analytics as VercelAnalytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster as ST } from "sonner";

import useTheme from "@chia/ui/utils/use-theme";

import { WebVitals } from "@/components/commons/web-vitals";
import { env } from "@/env";

const Toaster = () => {
  const { theme } = useTheme();
  return <ST theme={theme} position="bottom-left" richColors />;
};

const AppPlugins = () => {
  return (
    <>
      <Toaster />
      {env.NEXT_PUBLIC_ENV === "production" && (
        <>
          <VercelAnalytics />
          <WebVitals />
          {env.NEXT_PUBLIC_GTM_ID && (
            <GoogleTagManager gtmId={env.NEXT_PUBLIC_GTM_ID} />
          )}
          {env.NEXT_PUBLIC_GA_ID && (
            <GoogleAnalytics gaId={env.NEXT_PUBLIC_GA_ID} />
          )}
          <SpeedInsights />
        </>
      )}
    </>
  );
};

export default AppPlugins;
