import baseConfig from "@chia/eslint-config/base";
import nextjsConfig from "@chia/eslint-config/nextjs";
import reactConfig from "@chia/eslint-config/react";

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: [".next/**", "**/.map.ts"],
  },
  ...baseConfig,
  ...reactConfig,
  ...nextjsConfig,
];
