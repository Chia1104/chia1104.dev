export const antiSlopRules = {
  "anti-slop/no-chained-type-assertions": "error",
  "anti-slop/no-conditional-empty-object-spread": "error",
  "anti-slop/no-known-value-widening": "error",
  "anti-slop/no-module-mocking": "error",
  "anti-slop/no-object-parameters": "error",
  "anti-slop/no-reflect-apply": "error",
  "anti-slop/no-reflect-get": "error",
  "anti-slop/no-runtime-typeof": "error",
  "anti-slop/no-shape-in-symbol-names": "error",
  "anti-slop/no-unknown-parameters": "error",
  "anti-slop/no-unknown-returns": "error",
  "anti-slop/no-unknown-type-aliases": "error",
  "anti-slop/no-unsafe-dictionary-type": "error",
  "anti-slop/no-widen-then-assert": "error",
  "anti-slop/require-safety-comment-for-type-assertion": "error",
};

export const typescriptLintOverrides = [
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    rules: {
      // TypeScript intentionally allows a value and a type to share one name.
      "no-redeclare": "off",
    },
  },
  {
    files: [
      "**/__tests__/**",
      "**/*.{test,spec}.{js,jsx,ts,tsx,mjs,mts,cjs,cts}",
    ],
    rules: {
      // Framework-boundary tests intentionally replace modules such as server-only and Next hooks.
      "anti-slop/no-module-mocking": "off",
    },
  },
  {
    files: ["**/*.d.ts"],
    rules: {
      // Ambient declarations use import() to stay global instead of becoming modules.
      "typescript/consistent-type-imports": "off",
    },
  },
];
