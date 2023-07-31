"use client";

import { type FC, type ReactNode, useState } from "react";
import { SessionProvider } from "next-auth/react";
import { type Session } from "next-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useIsMounted } from "ui";
import { Toaster as ST } from "sonner";
import { useDarkMode } from "@/hooks";
import { NextUIProvider } from "@nextui-org/react";

interface Props {
  session: Session | null;
  children: ReactNode;
}

const Toaster: FC = () => {
  const { theme } = useDarkMode();
  const isMounted = useIsMounted();
  return (
    <ST theme={isMounted && (theme as any)} position="bottom-left" richColors />
  );
};

const RootProvider: FC<Props> = ({ session, children }) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            staleTime: Infinity,
          },
        },
      })
  );
  return (
    <SessionProvider session={session}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider enableSystem attribute="class">
          <NextUIProvider>
            <Toaster />
            {children}
          </NextUIProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
};

export default RootProvider;
