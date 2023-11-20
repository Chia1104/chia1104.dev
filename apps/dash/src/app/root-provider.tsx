"use client";

import { type FC, type ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { type Session } from "next-auth";
import { ThemeProvider } from "next-themes";
import { useIsMounted, useDarkMode } from "@chia/ui";
import { Toaster as ST } from "sonner";
import { NextUIProvider } from "@nextui-org/react";
import { TRPCReactProvider } from "@/trpc-api/client";

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
