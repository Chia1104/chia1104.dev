"use client";

import { type FC, type ReactNode, useState } from "react";
import { ThemeProvider } from "next-themes";
import { useDarkMode, useIsMounted } from "@chia/ui";
import { Toaster as ST } from "sonner";
import Script from "next/script";
import { env } from "@/env.mjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
  },
});

const ReactQueryProvider = ({ children }: { children: ReactNode }) => {
  const [internalQueryClient] = useState(() => queryClient);

  return (
    <QueryClientProvider client={internalQueryClient}>
      {children}
    </QueryClientProvider>
  );
};

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
      data-website-id={env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
      src={`${env.NEXT_PUBLIC_UMAMI_URL}/script.js`}
    />
  );
};

const RootProvider: FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <ThemeProvider enableSystem attribute="class">
      <ReactQueryProvider>
        <Toaster />
        <Analytics />
        {children}
      </ReactQueryProvider>
    </ThemeProvider>
  );
};

export default RootProvider;
