"use client";

import type { FC, ReactNode } from "react";

import { NextUIProvider } from "@nextui-org/react";
import { RootProvider as FDProvider } from "fumadocs-ui/provider";
import { ThemeProvider } from "next-themes";
import { useRouter } from "next/navigation";
import { Toaster as ST } from "sonner";

import { useCMD } from "@chia/ui/cmd";
import Cursor from "@chia/ui/cursor";
import type { Theme } from "@chia/ui/theme";
import useTheme from "@chia/ui/utils/use-theme";

import { TRPCReactProvider } from "@/trpc/client";

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
