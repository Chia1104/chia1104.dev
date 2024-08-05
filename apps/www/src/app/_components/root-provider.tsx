"use client";

import { useState } from "react";
import type { FC, ReactNode } from "react";

import { NextUIProvider } from "@nextui-org/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { loggerLink, unstable_httpBatchStreamLink } from "@trpc/client";
import { RootProvider as FDProvider } from "fumadocs-ui/provider";
import { ThemeProvider } from "next-themes";
import { useRouter } from "next/navigation";
import { Toaster as ST } from "sonner";
import superjson from "superjson";

import type { Theme } from "@chia/ui";
import { Cursor, useTheme, useCMD } from "@chia/ui";
import { getBaseUrl, WWW_BASE_URL } from "@chia/utils";

import { api } from "@/trpc-api";

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
        <FDProvider
          search={{
            enabled: false,
          }}>
          <TRPCReactProvider headers={headers}>
            <Toaster />
            <Cursor
              style={{
                opacity: 0.13,
                filter: "blur(50px)",
              }}
            />
            <ContactCMD />
            {children}
          </TRPCReactProvider>
        </FDProvider>
      </NextUIProvider>
    </ThemeProvider>
  );
};

export default RootProvider;
