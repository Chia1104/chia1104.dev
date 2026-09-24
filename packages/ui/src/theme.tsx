"use client";

import type { FC } from "react";
import { useId } from "react";

import type { ButtonProps } from "@heroui/react";
import { Button, Dropdown } from "@heroui/react";
import type {
  DropdownProps,
  DropdownItemProps,
  DropdownMenuProps,
  DropdownPopoverProps,
} from "@heroui/react";
import { useHotkey } from "@tanstack/react-hotkeys";
import type { Variant } from "motion/react";
import { motion } from "motion/react";

import { cn } from "../utils/cn.util";
import useTheme, { Theme } from "../utils/use-theme";

interface Props {
  variants?: ThemeVariants;
}

const VariantsKey = {
  Svg: "svgVariant",
  Circle: "circleVariant",
  MaskCircle: "maskCircleVariant",
  Lines: "linesVariant",
} as const;

type VariantsKey = (typeof VariantsKey)[keyof typeof VariantsKey];

type ThemeVariants = Record<VariantsKey, Record<Theme, Variant>>;

const defaultThemeVariants = {
  [VariantsKey.Svg]: {
    [Theme.Dark]: {
      rotate: 40,
    },
    [Theme.Light]: {
      rotate: 90,
    },
    [Theme.System]: {
      rotate: 0,
    },
  },
  [VariantsKey.Circle]: {
    [Theme.Dark]: {
      r: 9,
    },
    [Theme.Light]: {
      r: 5,
    },
    [Theme.System]: {
      r: 5,
    },
  },
  [VariantsKey.MaskCircle]: {
    [Theme.Dark]: {
      cx: "50%",
      cy: "23%",
    },
    [Theme.Light]: {
      cx: "100%",
      cy: "0%",
    },
    [Theme.System]: {
      cx: "100%",
      cy: "0%",
    },
  },
  [VariantsKey.Lines]: {
    [Theme.Dark]: {
      opacity: 0,
    },
    [Theme.Light]: {
      opacity: 1,
    },
    [Theme.System]: {
      opacity: 0,
    },
  },
} satisfies ThemeVariants;

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
      initial={Theme.System}
      variants={variants.svgVariant}
      animate={theme}>
      <mask id={`${id}-mask`}>
        <motion.rect x="0" y="0" width="100%" height="100%" fill="white" />
        <motion.circle
          r="9"
          fill="black"
          initial={Theme.System}
          variants={variants.maskCircleVariant}
          animate={theme}
        />
      </mask>
      <motion.circle
        cx="12"
        cy="12"
        fill="currentColor"
        mask={`url(#${id}-mask)`}
        initial={Theme.System}
        variants={variants.circleVariant}
        animate={theme}
      />
      <motion.g
        stroke="currentColor"
        initial={Theme.System}
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
    themeLabel?: Partial<Record<Theme, string>>;
    enableCMD?: boolean;
    buttonProps?: ButtonProps;
    dropdownProps?: {
      root?: Partial<DropdownProps>;
      menu?: Partial<
        DropdownMenuProps<{
          key: Theme;
          id: Theme;
        }>
      >;
      popover?: Partial<DropdownPopoverProps>;
      item?: Partial<DropdownItemProps>;
    };
  }
> = ({
  variants = defaultThemeVariants,
  label = "Theme",
  themeLabel = {
    [Theme.System]: "System",
    [Theme.Dark]: "Dark",
    [Theme.Light]: "Light",
  },
  enableCMD = false,
  buttonProps,
  dropdownProps,
}) => {
  const { theme = Theme.System, setTheme } = useTheme();
  return (
    <>
      {enableCMD && <ThemeCMD />}
      <Dropdown
        {...dropdownProps?.root}
        className={cn("not-prose", dropdownProps?.root?.className)}>
        <Button type="button" size="sm" {...buttonProps}>
          <MotionThemeIcon theme={theme} variants={variants} /> {label}
        </Button>
        <Dropdown.Popover {...dropdownProps?.popover}>
          <Dropdown.Menu {...dropdownProps?.menu}>
            <Dropdown.Item
              key={Theme.System}
              id={Theme.System}
              {...dropdownProps?.item}
              onPress={() => setTheme(Theme.System)}>
              <MotionThemeIcon theme={Theme.System} variants={variants} />{" "}
              {themeLabel[Theme.System]}
            </Dropdown.Item>
            <Dropdown.Item
              key={Theme.Dark}
              id={Theme.Dark}
              {...dropdownProps?.item}
              onPress={() => setTheme(Theme.Dark)}>
              <MotionThemeIcon theme={Theme.Dark} variants={variants} />
              {themeLabel[Theme.Dark]}
            </Dropdown.Item>
            <Dropdown.Item
              key={Theme.Light}
              id={Theme.Light}
              {...dropdownProps?.item}
              onPress={() => setTheme(Theme.Light)}>
              <MotionThemeIcon theme={Theme.Light} variants={variants} />
              {themeLabel[Theme.Light]}
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </>
  );
};

const ThemeCMD = () => {
  const { setTheme, isDarkMode } = useTheme();
  useHotkey("Mod+J", () => {
    setTheme(isDarkMode ? Theme.Light : Theme.Dark);
  });
  return null;
};

export default ThemeSelector;
export { MotionThemeIcon, defaultThemeVariants, ThemeCMD, type ThemeVariants };
