import { defineConfig } from "tsup";

export default defineConfig((opts) => ({
  entry: ["src/server.ts"],
  clean: true,
  minify: !opts.watch,
  dts: false,
  format: ["esm"],
  tsconfig: "tsconfig.build.json",
  external: [/!^@chia\//],
  noExternal: [/^@chia\//],
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
}));
