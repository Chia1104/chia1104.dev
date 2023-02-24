/** @type {import("prettier").Config} */
module.exports = {
  endOfLine: "auto",
  printWidth: 80,
  tabWidth: 2,
  trailingComma: "es5",
  bracketSameLine: true,
  plugins: [require.resolve("prettier-plugin-tailwindcss")],
};
