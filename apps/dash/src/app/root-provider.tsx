"use client";

import type { FC, ReactNode } from "react";

import { HeroUIProvider } from "@heroui/react";
import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { useRouter } from "next/navigation";
import { Toaster as ST } from "sonner";

import type { Theme } from "@chia/ui/theme";
import useTheme from "@chia/ui/utils/use-theme";

import { TRPCReactProvider } from "@/trpc/client";

interface Props {
  session: Session | null;
  children: ReactNode;
  headers: Headers;
}

const Toaster: FC = () => {
  const { theme } = useTheme();
  return <ST theme={theme as Theme} position="bottom-left" richColors />;
};

const RootProvider: FC<Props> = ({ session, children, headers }) => {
  const router = useRouter();
  return (
    <SessionProvider session={session}>
      <TRPCReactProvider headers={headers}>
        <ThemeProvider defaultTheme="system" enableSystem attribute="class">
          <HeroUIProvider navigate={void router.push}>
            <Toaster />
            {children}
          </HeroUIProvider>
        </ThemeProvider>
      </TRPCReactProvider>
    </SessionProvider>
  );
};

export default RootProvider;
