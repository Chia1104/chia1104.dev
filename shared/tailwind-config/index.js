const animation = require("./animation");
const plugin = require("tailwindcss/plugin");

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
  plugins: [
    plugin(function ({ addComponents }) {
      addComponents({
        ".ctw-container": {
          width: "100%",
          marginLeft: "auto",
          marginRight: "auto",
        },
      });
    }),
  ],
  darkMode: "class",
};

module.exports.animation = animation;
