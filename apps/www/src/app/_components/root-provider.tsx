"use client";

import { type FC, type ReactNode, useState } from "react";
import { ThemeProvider } from "next-themes";
import { useDarkMode, useIsMounted, Cursor } from "@chia/ui";
import { Toaster as ST } from "sonner";
import Script from "next/script";
import { env } from "@/env.mjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { loggerLink, unstable_httpBatchStreamLink } from "@trpc/client";
import superjson from "superjson";
import { api } from "@/trpc-api";
import { getBaseUrl } from "@/utils/getBaseUrl";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
  },
});

export function TRPCReactProvider(props: {
  children: React.ReactNode;
  headers?: Headers;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: Infinity,
          },
        },
      })
  );

  const [trpcClient] = useState(() =>
    api.createClient({
      transformer: superjson,
      links: [
        loggerLink({
          enabled: (opts) =>
            process.env.NODE_ENV === "development" ||
            (opts.direction === "down" && opts.result instanceof Error),
        }),
        unstable_httpBatchStreamLink({
          url: `${getBaseUrl()}/api/trpc`,
          // headers() {
          //   const headers = new Map(props.headers);
          //   headers.set("x-trpc-source", "nextjs-react");
          //   return Object.fromEntries(headers);
          // },
        }),
      ],
    })
  );

  return (
    <api.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {props.children}
      </QueryClientProvider>
    </api.Provider>
  );
}

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

const RootProvider: FC<{ children: ReactNode; headers?: Headers }> = ({
  children,
  headers,
}) => {
  return (
    <ThemeProvider enableSystem attribute="class">
      <TRPCReactProvider headers={headers}>
        <Toaster />
        <Analytics />
        <Cursor
          className="bg-gradient-to-r from-gray-700 to-gray-600 dark:from-gray-400 dark:to-gray-500"
          style={{
            opacity: 0.1,
            filter: "blur(50px)",
          }}
        />
        {children}
      </TRPCReactProvider>
    </ThemeProvider>
  );
};

export default RootProvider;
