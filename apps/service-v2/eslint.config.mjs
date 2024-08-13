import baseConfig from "@chia/eslint-config/base";
import reactConfig from "@chia/eslint-config/react";

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: ["**/*.d.ts"],
  },
  ...baseConfig,
  ...reactConfig,
];
