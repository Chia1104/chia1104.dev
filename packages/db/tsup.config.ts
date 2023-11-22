import { defineConfig, type Options } from "tsup";
import { readFile, writeFile } from "fs/promises";

const entries = ["./utils/posts/index.ts"];

export default defineConfig((opts) => {
  const base = {
    clean: !opts.watch,
    minify: true,
    dts: true,
    format: ["cjs", "esm"],
    target: "es2020",
    tsconfig: "tsconfig.build.json",
  } satisfies Options;
  return [
    {
      ...base,
      entry: ["./src/index.ts"],
    },
  ] satisfies Options[];
});

type PackageJson = {
  name: string;
  exports: Record<string, { import: string; types: string } | string>;
  typesVersions: Record<"*", Record<string, string[]>>;
  files: string[];
  dependencies: Record<string, string>;
  pnpm: {
    overrides: Record<string, string>;
  };
};
