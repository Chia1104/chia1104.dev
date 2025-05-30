"use client";

import type { FC, ReactNode } from "react";

import { HeroUIProvider } from "@heroui/react";
import { ThemeProvider } from "next-themes";
import { useTransitionRouter } from "next-view-transitions";
import { Toaster as ST } from "sonner";

import type { Theme } from "@chia/ui/theme";
import useTheme from "@chia/ui/utils/use-theme";

import { TRPCReactProvider } from "@/trpc/client";

interface Props {
  children: ReactNode;
  headers: Headers;
}

const Toaster: FC = () => {
  const { theme } = useTheme();
  return <ST theme={theme as Theme} position="bottom-left" richColors />;
};

const RootProvider: FC<Props> = ({ children, headers }) => {
  const router = useTransitionRouter();
  return (
    <TRPCReactProvider headers={headers}>
      <ThemeProvider defaultTheme="system" enableSystem attribute="class">
        <HeroUIProvider navigate={router.push}>
          <Toaster />
          {children}
        </HeroUIProvider>
      </ThemeProvider>
    </TRPCReactProvider>
  );
};

export default RootProvider;
