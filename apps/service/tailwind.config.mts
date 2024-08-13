import type { Config } from "tailwindcss";

import baseConfig, {
  egoistIcons,
  animation,
  shadcnConfig,
} from "@chia/tailwind";

export default {
  content: ["./**/*.{jsx,tsx}"],
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
