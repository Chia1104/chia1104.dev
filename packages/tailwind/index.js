const animation = require("./animation");
const shadcnConfig = require("./shadcn-ui");
const typography = require("@tailwindcss/typography");
const egoistIcons = require("./egoist-icons");

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#9200ff",
          light: "#b200ff",
          dark: "#6e00cc",
          transparent: "rgba(146,0,255,0.75)",
        },
        secondary: {
          DEFAULT: "#007aff",
          light: "#339cff",
          dark: "#0062cc",
          transparent: "rgba(0,122,255,0.75)",
        },
        success: {
          DEFAULT: "#4caf50",
          light: "#80e27e",
          dark: "#087f23",
          transparent: "rgba(76,175,80,0.75)",
        },
        info: {
          DEFAULT: "#2196f3",
          light: "#6ec6ff",
          dark: "#0069c0",
          transparent: "rgba(33,150,243,0.75)",
        },
        warning: {
          DEFAULT: "#ff9800",
          light: "#ffc947",
          dark: "#c66900",
          transparent: "rgba(255,152,0,0.75)",
        },
        danger: {
          DEFAULT: "#f44336",
          light: "#ff7961",
          dark: "#ba000d",
          transparent: "rgba(244,67,54,0.75)",
        },
        light: {
          DEFAULT: "#fafafa",
          light: "#ffffff",
          dark: "#c7c7c7",
          transparent: "rgba(250,250,250,0.75)",
        },
        dark: {
          DEFAULT: "#212121",
          light: "#484848",
          dark: "#000000",
          transparent: "rgba(33,33,33,0.75)",
        },
        code: {
          DEFAULT: "#24292e",
          light: "#484848",
          dark: "#000000",
          transparent: "rgba(36,41,46,0.75)",
        },
        cyan: {
          DEFAULT: "#00bcd4",
          light: "#62efff",
          dark: "#008ba3",
          transparent: "rgba(0,188,212,0.75)",
        },
        teal: {
          DEFAULT: "#009688",
          light: "#52c7b8",
          dark: "#00675b",
          transparent: "rgba(0,150,136,0.75)",
        },
        purple: {
          DEFAULT: "#9c27b0",
          light: "#d05ce3",
          dark: "#6a0080",
          transparent: "rgba(156,39,176,0.75)",
        },
        /** @TODO: Add more colors */
        cyberpunk: {
          DEFAULT: "#F2E307",
          light: "#F2E307",
          dark: "#F2E307",
          transparent: "rgba(242,227,7,0.75)",
        },
      },
      typography: {
        DEFAULT: {
          css: {
            a: {
              textDecoration: "rgb(55, 65, 81, 0.7) underline",
              transition: "all 0.3s ease-in-out",
              textUnderlineOffset: "5px",
            },
            ".dark a": {
              textDecoration: "rgb(209, 213, 219, 0.7) underline",
            },
            "a:hover": {
              textDecoration: "#000 underline",
            },
            ".dark a:hover": {
              textDecoration: "#fff underline",
            },
          },
        },
      },
    },
  },
  darkMode: "class",
  plugins: [typography],
};

module.exports.animation = animation;
module.exports.shadcnConfig = shadcnConfig;
module.exports.egoistIcons = egoistIcons;
