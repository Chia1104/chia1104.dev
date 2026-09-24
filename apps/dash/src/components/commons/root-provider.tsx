"use client";

import { useState } from "react";

import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster as ST } from "sonner";

import useTheme, { Theme } from "@chia/ui/utils/use-theme";
import { getQueryClient } from "@chia/utils/query-client";

import { ImpersonationBanner } from "./impersonation-banner";

interface Props {
  children: React.ReactNode;
}

const Toaster = () => {
  const { theme } = useTheme();
  return <ST theme={theme} position="bottom-left" richColors />;
};

const RootProvider = ({ children }: Props) => {
  const [queryClient] = useState(() => getQueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <NuqsAdapter>
        <ThemeProvider
          defaultTheme={Theme.System}
          enableSystem
          attribute="class">
          <Toaster />
          <ImpersonationBanner />
          {children}
        </ThemeProvider>
      </NuqsAdapter>
    </QueryClientProvider>
  );
};

export default RootProvider;
