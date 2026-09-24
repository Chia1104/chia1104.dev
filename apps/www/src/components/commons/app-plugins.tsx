"use client";

import { GoogleTagManager } from "@next/third-parties/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { Analytics as VercelAnalytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster as ST } from "sonner";

import Cursor from "@chia/ui/cursor";
import useTheme from "@chia/ui/utils/use-theme";

import { WebVitals } from "@/components/commons/web-vitals";
import { env } from "@/env";
import { useSettingsStore } from "@/stores/settings/store";

const Toaster = () => {
  const { theme } = useTheme();
  return <ST theme={theme} position="bottom-left" richColors />;
};

const AppPlugins = () => {
  const cursorEnabled = useSettingsStore((s) => s.cursorEnabled);
  return (
    <>
      <Toaster />
      {cursorEnabled && (
        <Cursor
          style={{
            opacity: 0.13,
            filter: "blur(50px)",
          }}
        />
      )}
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
