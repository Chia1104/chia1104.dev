const animation = require("./animation.js");

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        ctw_primary: "#9200ff",
        ctw_secondary: "#007aff",
        ctw_success: "#4caf50",
        ctw_info: "#2196f3",
        ctw_warning: "#ff9800",
        ctw_danger: "#f44336",
        ctw_light: "#fafafa",
        ctw_dark: "#212121",
        ctw_white: "#ffffff",
        ctw_black: "#000000",
        ctw_code: "#24292e",
      },
    },
  },
  darkMode: "class",
};

module.exports.animation = animation;
