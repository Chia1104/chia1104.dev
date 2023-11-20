"use client";

import { type FC, type ReactNode, useState } from "react";
import { SessionProvider } from "next-auth/react";
import { type Session } from "next-auth";
import { ThemeProvider } from "next-themes";
import { useIsMounted, useDarkMode } from "@chia/ui";
import { Toaster as ST } from "sonner";
import { NextUIProvider } from "@nextui-org/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { loggerLink, unstable_httpBatchStreamLink } from "@trpc/client";
import superjson from "superjson";
import { env } from "@/env.mjs";
import { api } from "@/trpc-api";
import { getBaseUrl } from "@/utils/getBaseUrl";

interface Props {
  session: Session | null;
  children: ReactNode;
  headers: Headers;
}

const Toaster: FC = () => {
  const { theme } = useDarkMode();
  const isMounted = useIsMounted();
  return (
    <ST theme={isMounted && (theme as any)} position="bottom-left" richColors />
  );
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
            staleTime: 5 * 1000,
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
  return (
    <SessionProvider session={session}>
      <TRPCReactProvider headers={headers}>
        <ThemeProvider enableSystem attribute="class">
          <NextUIProvider>
            <Toaster />
            {children}
          </NextUIProvider>
        </ThemeProvider>
      </TRPCReactProvider>
    </SessionProvider>
  );
};

export default RootProvider;
