import { nextui } from "@nextui-org/react";
import { docsUi } from "fumadocs-ui/tailwind-plugin";
import tailwindScrollbar from "tailwind-scrollbar";
import type { Config } from "tailwindcss";

import baseConfig from "@chia/tailwind";
import animation from "@chia/tailwind/animation";
import egoistIcons from "@chia/tailwind/egoist-icons";
import shadcnConfig from "@chia/tailwind/shadcn-ui";

export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "node_modules/@chia/ui/src/**/*.{js,ts,jsx,tsx}",
    "node_modules/@chia/mdx/src/**/*.tsx",
    "node_modules/@chia/editor/src/**/*.{js,ts,jsx,tsx}",
    "node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}",
    "node_modules/fumadocs-ui/dist/**/*.js",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#00e1ff",
        secondary: "#ff00e1",
        "sec-text": "#444444",
        bgPurple: "rgba(111,66,193,0.65)",
        bgPink: "rgba(255,107,237,0.35)",
        bgBlue: "rgba(117,149,255,0.3)",
      },
    },
  },
  plugins: [
    nextui(),
    tailwindScrollbar({ nocompatible: true }),
    docsUi({ modifyContainer: false, cssPrefix: "fd-" }),
  ],
  darkMode: "class",
  presets: [
    shadcnConfig,
    animation({
      disableTailwindAnimation: true,
    }),
    baseConfig,
    egoistIcons,
  ],
} satisfies Config;
