"use client";

import { type FC, type ReactNode, useState } from "react";
import { SessionProvider } from "next-auth/react";
import { type Session } from "next-auth";
import { ThemeProvider } from "next-themes";
import { useTheme, Theme } from "@chia/ui";
import { Toaster as ST } from "sonner";
import { NextUIProvider } from "@nextui-org/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { loggerLink, unstable_httpBatchStreamLink } from "@trpc/client";
import superjson from "superjson";
import { api } from "@/trpc-api";
import { getBaseUrl, DASH_BASE_URL } from "@chia/utils";
import { useRouter } from "next/navigation";

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
          <NextUIProvider navigate={router.push}>
            <Toaster />
            {children}
          </NextUIProvider>
        </ThemeProvider>
      </TRPCReactProvider>
    </SessionProvider>
  );
};

export default RootProvider;
