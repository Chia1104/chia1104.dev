import baseConfig from "@chia/eslint-config/base";
import reactConfig from "@chia/eslint-config/react";

/** @type {import('typescript-eslint').Config} */
const eslintConfig = [
  {
    ignores: [".next/**"],
  },
  ...baseConfig,
  ...reactConfig,
];

export default eslintConfig;
