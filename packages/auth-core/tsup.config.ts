import { defineConfig, type Options } from "tsup";

export default defineConfig((opts) => {
  return {
    entry: ["src/index.ts", "src/utils.ts", "src/env.ts", "src/cjs.ts"],
    clean: true,
    minify: !opts.watch,
    dts: true,
    format: ["cjs", "esm"],
    target: "es2020",
    tsconfig: "tsconfig.build.json",
    splitting: false,
  } satisfies Options;
});
