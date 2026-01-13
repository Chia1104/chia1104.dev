import { defineConfig } from "tsdown";

export default defineConfig((opts) => ({
  entry: ["src/server.ts"],
  clean: true,
  minify: !opts.watch,
  dts: false,
  unbundle: true,
  format: ["esm"],
  tsconfig: "tsconfig.build.json",
}));
