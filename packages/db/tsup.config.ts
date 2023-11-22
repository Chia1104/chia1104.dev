import { defineConfig, type Options } from "tsup";

export default defineConfig((opts) => {
  return {
    entry: ["index.ts"],
    clean: !opts.watch,
    minify: true,
    dts: true,
    format: ["cjs", "esm"],
    target: "es2020",
    tsconfig: "tsconfig.build.json",
  } satisfies Options;
});
