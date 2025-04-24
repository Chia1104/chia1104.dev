import { heroui } from "@heroui/react";
import type { PluginsConfig } from "tailwindcss/plugin";

const plugin: PluginsConfig = heroui({
  themes: {
    light: {
      colors: {
        background: {
          DEFAULT: "#dddddd",
        },
      },
    },
  },
});

export default plugin;
