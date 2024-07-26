/** @type {import("prettier").Config} */
module.exports = {
  endOfLine: "auto",
  printWidth: 80,
  tabWidth: 2,
  trailingComma: "es5",
  bracketSameLine: true,
  importOrder: [
    "^react$",
    "<THIRD_PARTY_MODULES>",
    "^@chia/(.*)$",
    "^@/(.*)$",
    "^[./]",
  ],
  importOrderSeparation: true,
  importOrderParserPlugins: ["typescript", "jsx", "decorators-legacy"],
  plugins: [
    require.resolve("prettier-plugin-tailwindcss"),
    require.resolve("@trivago/prettier-plugin-sort-imports"),
  ],
};
