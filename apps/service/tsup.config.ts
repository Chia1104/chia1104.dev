import { defineConfig } from "tsup";

export default defineConfig((opts) => ({
  entry: ["src/server.ts"],
  clean: true,
  minify: !opts.watch,
  dts: false,
  format: ["esm"],
  tsconfig: "tsconfig.build.json",
  noExternal: [
    "@chia/ai",
    "@chia/auth-core",
    "@chia/cache",
    "@chia/db",
    "@chia/utils",
    "@chia/api",
  ],
  shims: true,
}));
