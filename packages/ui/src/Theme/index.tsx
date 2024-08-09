"use client";

import { useId } from "react";
import type { FC } from "react";

import {
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  ButtonProps,
} from "@nextui-org/react";
import { motion } from "framer-motion";
import type { Variant } from "framer-motion";

import { useCMD } from "../CMD";
import useTheme from "../utils/use-theme";

interface Props {
  variants?: ThemeVariants;
}

export const Theme = {
  SYSTEM: "system",
  DARK: "dark",
  LIGHT: "light",
} as const;

export type Theme = (typeof Theme)[keyof typeof Theme];

const VariantsKey = {
  SVG: "svgVariant",
  CIRCLE: "circleVariant",
  MASK_CIRCLE: "maskCircleVariant",
  LINES: "linesVariant",
} as const;

type VariantsKey = (typeof VariantsKey)[keyof typeof VariantsKey];

type ThemeVariants = Record<VariantsKey, Record<Theme, Variant>>;

const defaultThemeVariants: ThemeVariants = {
  [VariantsKey.SVG]: {
    dark: {
      rotate: 40,
    },
    light: {
      rotate: 90,
    },
    system: {
      rotate: 0,
    },
  },
  [VariantsKey.CIRCLE]: {
    dark: {
      r: 9,
    },
    light: {
      r: 5,
    },
    system: {
      r: 5,
    },
  },
  [VariantsKey.MASK_CIRCLE]: {
    dark: {
      cx: "50%",
      cy: "23%",
    },
    light: {
      cx: "100%",
      cy: "0%",
    },
    system: {
      cx: "100%",
      cy: "0%",
    },
  },
  [VariantsKey.LINES]: {
    dark: {
      opacity: 0,
    },
    light: {
      opacity: 1,
    },
    system: {
      opacity: 0,
    },
  },
};

const MotionThemeIcon: FC<{
  theme: Theme;
  variants: ThemeVariants;
}> = ({ theme, variants }) => {
  const id = useId();
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      initial="system"
      variants={variants.svgVariant}
      animate={theme}>
      <mask id={`${id}-mask`}>
        <motion.rect x="0" y="0" width="100%" height="100%" fill="white" />
        <motion.circle
          r="9"
          fill="black"
          initial="system"
          variants={variants.maskCircleVariant}
          animate={theme}
        />
      </mask>
      <motion.circle
        cx="12"
        cy="12"
        fill="currentColor"
        mask={`url(#${id}-mask)`}
        initial="system"
        variants={variants.circleVariant}
        animate={theme}
      />
      <motion.g
        stroke="currentColor"
        initial="system"
        variants={variants.linesVariant}
        animate={theme}>
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </motion.g>
    </motion.svg>
  );
};

const ThemeSelector: FC<
  Props & {
    label?: string;
    enableCMD?: boolean;
    buttonProps?: ButtonProps;
  }
> = ({
  variants = defaultThemeVariants,
  label = "Theme",
  enableCMD = false,
  buttonProps,
}) => {
  const { theme = "system", setTheme } = useTheme();
  return (
    <>
      {enableCMD && <ThemeCMD />}
      <Dropdown className="not-prose">
        <DropdownTrigger>
          <Button
            variant="flat"
            size="sm"
            startContent={
              <MotionThemeIcon theme={theme as Theme} variants={variants} />
            }
            {...buttonProps}>
            {label}
          </Button>
        </DropdownTrigger>
        <DropdownMenu>
          <DropdownItem
            key="system"
            startContent={
              <MotionThemeIcon theme={Theme.SYSTEM} variants={variants} />
            }
            onPress={() => setTheme(Theme.SYSTEM)}>
            System
          </DropdownItem>
          <DropdownItem
            key="dark"
            startContent={
              <MotionThemeIcon theme={Theme.DARK} variants={variants} />
            }
            onPress={() => setTheme(Theme.DARK)}>
            Dark
          </DropdownItem>
          <DropdownItem
            key="light"
            startContent={
              <MotionThemeIcon theme={Theme.LIGHT} variants={variants} />
            }
            onPress={() => setTheme(Theme.LIGHT)}>
            Light
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>
    </>
  );
};

const ThemeCMD = () => {
  const { theme, setTheme, isDarkMode } = useTheme();
  useCMD(
    false,
    {
      cmd: "j",
      onKeyDown: () => {
        setTheme(isDarkMode ? "light" : "dark");
      },
    },
    [theme, isDarkMode]
  );
  return null;
};

export default ThemeSelector;
export { MotionThemeIcon, defaultThemeVariants, ThemeCMD, type ThemeVariants };
