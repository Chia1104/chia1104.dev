import { defineConfig } from "tsdown";

export default defineConfig((opts) => ({
  entry: ["src/server.ts"],
  clean: true,
  minify: !opts.watch,
  dts: false,
  unbundle: false,
  format: ["esm"],
  tsconfig: "tsconfig.build.json",
  external: [/!^@chia\//],
  noExternal: [/^@chia\//, /^trigger\//],
}));
