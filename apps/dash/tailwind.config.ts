import type { Config } from "tailwindcss";
import baseConfig from "@chiastack/tailwind-config";
import { nextui } from "@nextui-org/theme";

export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "node_modules/ui/src/**/*.{js,ts,jsx,tsx}",
    "node_modules/@nextui-org/theme/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [nextui()],
  darkMode: "class",
  presets: [baseConfig],
} satisfies Config;
