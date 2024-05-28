const { quote } = require("shell-quote");

const isWin = process.platform === "win32";

module.exports = {
  "**/*.{js,jsx,cjs,mjs,ts,tsx,md,vue,json}": (filenames) => {
    const escapedFileNames = filenames
      .map((filename) => `"${isWin ? filename : escape([filename])}"`)
      .join(" ");
    return [
      `prettier --write ${escapedFileNames}`,
      `git add ${escapedFileNames}`,
    ];
  },
};

function escape(str) {
  const escaped = quote(str);
  return escaped.replace(/\\@/g, "@");
}
