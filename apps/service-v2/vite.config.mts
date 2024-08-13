import { viteCommonjs, esbuildCommonjs } from "@originjs/vite-plugin-commonjs";
import honox from "honox/vite";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    conditions: ["source"],
    alias: [
      {
        find: /@\//,
        replacement: path.join(__dirname, "./src/"),
      },
    ],
  },
  plugins: [
    honox({
      client: {
        input: ["/src/styles.css"],
      },
    }),
    viteCommonjs(),
  ],
  optimizeDeps: {
    esbuildOptions: {
      plugins: [esbuildCommonjs(["cookie"])],
    },
  },
});
