import reactPlugin from "eslint-plugin-react";
import hooksPlugin from "eslint-plugin-react-hooks";
import { defineConfig } from "eslint/config";

const reactConfig = defineConfig([
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      react: reactPlugin,
      "react-hooks": hooksPlugin,
    },
    rules: {
      ...reactPlugin.configs["jsx-runtime"].rules,
      ...hooksPlugin.configs.recommended.rules,
      "react-hooks/refs": "warn",
    },
    languageOptions: {
      globals: {
        React: "writable",
      },
    },
  },
]);

export default reactConfig;
