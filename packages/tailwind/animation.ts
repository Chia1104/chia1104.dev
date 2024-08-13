import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

type Options = {
  disableTailwindAnimation?: boolean;
};

const config = (options?: Options) => {
  options ??= {};
  const { disableTailwindAnimation = false } = options;
  return {
    theme: {
      extend: {
        keyframes: {
          "accordion-down": {
            from: { height: "0" },
            to: { height: "var(--radix-accordion-content-height)" },
          },
          "accordion-up": {
            from: { height: "var(--radix-accordion-content-height)" },
            to: { height: "0" },
          },
          "cia-marquee": {
            from: { transform: "translateX(0)" },
            to: { transform: "translateX(calc(-100% - var(--gap)))" },
          },
          "cia-marquee-vertical": {
            from: { transform: "translateY(0)" },
            to: { transform: "translateY(calc(-100% - var(--gap)))" },
          },
          "cia-shimmer": {
            "0%, 90%, 100%": {
              "background-position": "calc(-100% - var(--shimmer-width)) 0",
            },
            "30%, 60%": {
              "background-position": "calc(100% + var(--shimmer-width)) 0",
            },
          },
          "cia-grid": {
            "0%": { transform: "translateY(-50%)" },
            "100%": { transform: "translateY(0)" },
          },
          "cia-meteor": {
            "0%": { transform: "rotate(215deg) translateX(0)", opacity: "1" },
            "70%": { opacity: "1" },
            "100%": {
              transform: "rotate(215deg) translateX(-500px)",
              opacity: "0",
            },
          },
          "cia-border-beam": {
            "100%": {
              "offset-distance": "100%",
            },
          },
          "cia-spin-around": {
            "0%": {
              transform: "translateZ(0) rotate(0)",
            },
            "15%, 35%": {
              transform: "translateZ(0) rotate(90deg)",
            },
            "65%, 85%": {
              transform: "translateZ(0) rotate(270deg)",
            },
            "100%": {
              transform: "translateZ(0) rotate(360deg)",
            },
          },
          "cia-slide": {
            to: {
              transform: "translate(calc(100cqw - 100%), 0)",
            },
          },
          "cia-spotlight": {
            "0%": {
              opacity: "0",
              transform: "translate(-72%, -62%) scale(0.5)",
            },
            "100%": {
              opacity: "1",
              transform: "translate(-50%,-40%) scale(1)",
            },
          },
        },
        animation: {
          "accordion-down": "accordion-down 0.2s ease-out",
          "accordion-up": "accordion-up 0.2s ease-out",
          "cia-marquee": "cia-marquee var(--duration) linear infinite",
          "cia-marquee-vertical":
            "cia-marquee-vertical var(--duration) linear infinite",
          "cia-shimmer": "cia-shimmer 8s infinite",
          "cia-grid": "cia-grid 15s linear infinite",
          "cia-meteor": "cia-meteor 5s linear infinite",
          "cia-border-beam":
            "cia-border-beam calc(var(--duration)*1s) infinite linear",
          "cia-spin-around":
            "cia-spin-around calc(var(--speed) * 2) infinite linear",
          "cia-slide": "cia-slide var(--speed) ease-in-out infinite alternate",
          "cia-spotlight": "cia-spotlight 2s ease .75s 1 forwards",
        },
      },
    },
    plugins: [
      !disableTailwindAnimation ? tailwindcssAnimate : { handler: () => {} },
    ],
  } satisfies Partial<Config>;
};

export default config;
