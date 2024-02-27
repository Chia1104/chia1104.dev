import type { Config } from "tailwindcss";
import baseConfig, {
  egoistIcons,
  animation,
  shadcnConfig,
} from "@chia/tailwind";
import { nextui } from "@nextui-org/react";
import tailwindScrollbar from "tailwind-scrollbar";

export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "node_modules/@chia/ui/src/**/*.{js,ts,jsx,tsx}",
    "node_modules/@chia/editor/src/**/*.{js,ts,jsx,tsx}",
    "node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}",
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
    nextui({
      prefix: "nextui",
      addCommonColors: false,
      themes: {
        light: {
          colors: {
            background: "DEFAULT",
          },
        },
        dark: {
          colors: {
            background: "DEFAULT",
          },
        },
      },
    }),
    tailwindScrollbar({ nocompatible: true }),
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
