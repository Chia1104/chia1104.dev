"use client";

import { type FC, type ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { useDarkMode, useIsMounted } from "@chia/ui";
import { Toaster as ST } from "sonner";
import Script from "next/script";

const Toaster: FC = () => {
  const { theme } = useDarkMode();
  const isMounted = useIsMounted();
  return (
    <ST theme={isMounted && (theme as any)} position="bottom-left" richColors />
  );
};

const Analytics = () => {
  if (process.env.NODE_ENV !== "production") return null;

  return (
    <Script
      async
      data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
      src={`${process.env.NEXT_PUBLIC_UMAMI_URL}/script.js`}
    />
  );
};

const RootProvider: FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <ThemeProvider enableSystem attribute="class">
      <Toaster />
      <Analytics />
      {children}
    </ThemeProvider>
  );
};

export default RootProvider;
