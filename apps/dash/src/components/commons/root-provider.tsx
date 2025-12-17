"use client";

import { useState } from "react";

import { HeroUIProvider } from "@heroui/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useTransitionRouter } from "next-view-transitions";
import { Toaster as ST } from "sonner";

import type { Theme } from "@chia/ui/theme";
import useTheme from "@chia/ui/utils/use-theme";

import { getQueryClient } from "@/libs/utils/query-client";

interface Props {
  children: React.ReactNode;
}

const Toaster = () => {
  const { theme } = useTheme();
  return <ST theme={theme as Theme} position="bottom-left" richColors />;
};

const RootProvider = ({ children }: Props) => {
  const router = useTransitionRouter();
  const [queryClient] = useState(() => getQueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" enableSystem attribute="class">
        <HeroUIProvider navigate={router.push}>
          <Toaster />
          {children}
        </HeroUIProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default RootProvider;
