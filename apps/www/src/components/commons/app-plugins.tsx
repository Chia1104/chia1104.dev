"use client";

import { Suspense } from "react";

import { GoogleTagManager } from "@next/third-parties/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { Analytics as VercelAnalytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { useQueryState } from "nuqs";
import { Toaster as ST } from "sonner";

import { useCMD } from "@chia/ui/cmd";
import Cursor from "@chia/ui/cursor";
import type { Theme } from "@chia/ui/theme";
import useTheme from "@chia/ui/utils/use-theme";

import { WebVitals } from "@/components/commons/web-vitals";
import { env } from "@/env";
import { useSettingsStore } from "@/stores/settings/store";

/** Mounted only while chat is enabled so a disabled chat never swallows the shortcut. */
const ContactCMD = () => {
  const [isOpen, setIsOpen] = useQueryState("chat");
  useCMD(false, {
    cmd: "i",
    onKeyDown: () => {
      setIsOpen(isOpen ? null : "true");
    },
  });
  return null;
};

const Toaster = () => {
  const { theme } = useTheme();
  return (
    <ST
      theme={
        /* SAFETY: The producer contract guarantees this value satisfies Theme. */ theme as Theme
      }
      position="bottom-left"
      richColors
    />
  );
};

const AppPlugins = () => {
  const cursorEnabled = useSettingsStore((s) => s.cursorEnabled);
  const aiEnabled = useSettingsStore((s) => s.aiEnabled);
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
      {aiEnabled && (
        <Suspense>
          <ContactCMD />
        </Suspense>
      )}
      {/* <ReactQueryDevtools initialIsOpen={false} /> */}
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
