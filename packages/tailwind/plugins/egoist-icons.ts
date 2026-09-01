import { iconsPlugin, getIconCollections } from "@egoist/tailwindcss-icons";

const plugin = iconsPlugin({
  collections: getIconCollections([
    "mdi",
    "lucide",
    "devicon",
    "logos",
    "ion",
    "simple-icons",
  ]),
});

export default plugin;
