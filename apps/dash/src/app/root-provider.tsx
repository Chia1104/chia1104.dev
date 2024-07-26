"use client";

import { useState } from "react";
import type { FC, ReactNode } from "react";

import { NextUIProvider } from "@nextui-org/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { loggerLink, unstable_httpBatchStreamLink } from "@trpc/client";
import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { useRouter } from "next/navigation";
import { Toaster as ST } from "sonner";
import superjson from "superjson";

import type { Theme } from "@chia/ui";
import { useTheme } from "@chia/ui";
import { getBaseUrl, DASH_BASE_URL } from "@chia/utils";

import { api } from "@/trpc-api";

interface Props {
  session: Session | null;
  children: ReactNode;
  headers: Headers;
}

const Toaster: FC = () => {
  const { theme } = useTheme();
  return <ST theme={theme as Theme} position="bottom-left" richColors />;
};

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
            baseUrl: DASH_BASE_URL,
          })}/api/trpc`,
          headers() {
            const headers = new Map(props.headers);
            headers.set("x-trpc-source", "nextjs-react");
            return Object.fromEntries(headers);
          },
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

const RootProvider: FC<Props> = ({ session, children, headers }) => {
  const router = useRouter();
  return (
    <SessionProvider session={session}>
      <TRPCReactProvider headers={headers}>
        <ThemeProvider defaultTheme="system" enableSystem attribute="class">
          <NextUIProvider navigate={void router.push}>
            <Toaster />
            {children}
          </NextUIProvider>
        </ThemeProvider>
      </TRPCReactProvider>
    </SessionProvider>
  );
};

export default RootProvider;
