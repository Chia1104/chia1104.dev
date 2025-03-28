import { heroui } from "@heroui/react";
import aspectRatio from "@tailwindcss/aspect-ratio";
import { docsUi } from "fumadocs-ui/tailwind-plugin";
import tailwindScrollbar from "tailwind-scrollbar";
import type { Config } from "tailwindcss";

import baseConfig from "@chia/tailwind";
import animation from "@chia/tailwind/animation";
import egoistIcons from "@chia/tailwind/egoist-icons";
import shadcnConfig from "@chia/tailwind/shadcn-ui";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "node_modules/@chia/ui/src/**/*.{js,ts,jsx,tsx}",
    "node_modules/@chia/contents/src/**/*.tsx",
    "node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
    "node_modules/fumadocs-ui/dist/**/*.js",
    "!./src/**/*.test.{js,ts,jsx,tsx}",
    "!./src/**/*.spec.{js,ts,jsx,tsx}",
    "!./src/app/api/contact/email-template.tsx",
  ],
  theme: {
    screens: {
      sm: "640px",
      md: "768px",
      lg: "992px",
      xl: "992px",
      "2xl": "992px",
    },
    extend: {
      colors: {
        "sec-text": "#444444",
        success: "#4caf50",
        info: "#2196f3",
        warning: "#ff9800",
        danger: "#f44336",
        light: "#fafafa",
        dark: "#212121",
        white: "#ffffff",
        black: "#000000",
        code: "#24292e",
        bgPurple: "rgba(111,66,193,0.65)",
        bgPink: "rgba(255,107,237,0.35)",
        bgBlue: "rgba(117,149,255,0.3)",
      },
      keyframes: {
        wave: {
          "0%": { transform: "rotate(0.0deg)" },
          "10%": { transform: "rotate(14deg)" },
          "20%": { transform: "rotate(-8deg)" },
          "30%": { transform: "rotate(14deg)" },
          "40%": { transform: "rotate(-4deg)" },
          "50%": { transform: "rotate(10.0deg)" },
          "60%": { transform: "rotate(0.0deg)" },
          "100%": { transform: "rotate(0.0deg)" },
        },
      },
      animation: {
        "waving-hand": "wave 3.5s ease 1s infinite",
      },
    },
  },
  corePlugins: {
    aspectRatio: false,
  },
  plugins: [
    heroui({
      themes: {
        light: {
          colors: {
            background: {
              DEFAULT: "#dddddd",
            },
          },
        },
      },
    }),
    aspectRatio,
    tailwindScrollbar({ nocompatible: true }),
    docsUi({ modifyContainer: false, cssPrefix: "fd-" }),
  ],
  darkMode: "class",
  presets: [shadcnConfig, animation(), baseConfig, egoistIcons],
};

export default config;
