import { iconsPlugin, getIconCollections } from "@egoist/tailwindcss-icons";
import type { Config } from "tailwindcss";

const config = {
  plugins: [
    iconsPlugin({
      // Select the icon collections you want to use
      // You can also ignore this option to automatically discover all icon collections you have installed
      collections: getIconCollections([
        "mdi",
        "lucide",
        "devicon",
        "logos",
        "ion",
        "simple-icons",
      ]),
    }) as any,
  ],
} satisfies Partial<Config>;

export default config;
