import { defineConfig } from "tsup";

export default defineConfig((opts) => ({
  entry: ["src/**/*.ts"],
  clean: true,
  minify: !opts.watch,
  dts: false,
  format: ["esm"],
  tsconfig: "tsconfig.build.json",
  noExternal: [
    "@chia/auth-core-esm",
    "@chia/cache",
    "@chia/db",
    "@chia/utils",
    "@chia/api",
  ],
  shims: true,
}));
