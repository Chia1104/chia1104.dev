const { quote } = require("shell-quote");
const { ESLint } = require("eslint");

const eslint = new ESLint();
const isWin = process.platform === "win32";

module.exports = {
  "**/*.{js,jsx,ts,tsx,vue,mjs,cjs}": (filenames) => {
    const escapedFileNames = filenames
      .map((filename) => `"${isWin ? filename : escape([filename])}"`)
      .join(" ");
    return [
      `prettier --write ${escapedFileNames}`,
      `eslint --fix ${filenames
        .filter((file) => !eslint.isPathIgnored(file))
        .map((f) => `"${f}"`)
        .join(" ")}`,
      `git add ${escapedFileNames}`,
    ];
  },
};

function escape(str) {
  const escaped = quote(str);
  return escaped.replace(/\\@/g, "@");
}
