"use client";

import { useState } from "react";
import type { FC, ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import type { Theme } from "@chia/ui";
import { Cursor, useTheme, useCMD } from "@chia/ui";
import { Toaster as ST } from "sonner";
import Script from "next/script";
import { env } from "@/env";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { loggerLink, unstable_httpBatchStreamLink } from "@trpc/client";
import superjson from "superjson";
import { api } from "@/trpc-api";
import { getBaseUrl, WWW_BASE_URL } from "@chia/utils";
import { useRouter } from "next/navigation";
import { NextUIProvider } from "@nextui-org/react";

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
      links: [
        loggerLink({
          enabled: (opts) =>
            process.env.NODE_ENV === "development" ||
            (opts.direction === "down" && opts.result instanceof Error),
        }),
        unstable_httpBatchStreamLink({
          transformer: superjson,
          url: `${getBaseUrl({
            baseUrl: WWW_BASE_URL,
          })}/api/trpc`,
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
  const { theme } = useTheme();
  return <ST theme={theme as Theme} position="bottom-left" richColors />;
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

const RootProvider: FC<{ children: ReactNode; headers?: Headers }> = ({
  children,
  headers,
}) => {
  const router = useRouter();
  return (
    <ThemeProvider defaultTheme="system" enableSystem attribute="class">
      <NextUIProvider navigate={void router.push}>
        <TRPCReactProvider headers={headers}>
          <Toaster />
          <Analytics />
          <Cursor
            style={{
              opacity: 0.13,
              filter: "blur(50px)",
            }}
          />
          <ContactCMD />
          {children}
        </TRPCReactProvider>
      </NextUIProvider>
    </ThemeProvider>
  );
};

export default RootProvider;
