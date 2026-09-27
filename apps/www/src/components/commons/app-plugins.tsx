"use client";

import { Toaster as ST } from "sonner";

import useTheme from "@chia/ui/utils/use-theme";

const Toaster = () => {
  const { theme } = useTheme();
  return <ST theme={theme} position="bottom-left" richColors />;
};

/** Analytics is Cloudflare Web Analytics, which the edge injects into every HTML response. */
const AppPlugins = () => <Toaster />;

export default AppPlugins;
