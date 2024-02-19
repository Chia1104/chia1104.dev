"use client";

import { type FC, useId } from "react";
import { motion, type Variant } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../DropdownMenu";
import { Button } from "../Button";
import { useTheme } from "next-themes";

interface Props {
  /**
   * @deprecated
   */
  toggleTheme?: () => void;
  /**
   * @deprecated
   */
  isDark?: boolean;
  variants?: ThemeVariants;
}

export const Theme = {
  SYSTEM: "system",
  DARK: "dark",
  LIGHT: "light",
} as const;

export type Theme = (typeof Theme)[keyof typeof Theme];

const VariantsKey = {
  SVG: "svgVariants",
  CIRCLE: "circleVariants",
  MASK: "maskVariants",
  LINES: "linesVariants",
} as const;

type VariantsKey = (typeof VariantsKey)[keyof typeof VariantsKey];

export type ThemeVariants = Record<VariantsKey, Record<Theme, Variant>>;

const defaultThemeVariants: ThemeVariants = {
  svgVariants: {
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
  circleVariants: {
    dark: {
      r: 9,
    },
    light: {
      r: 5,
    },
    system: {
      r: 7,
    },
  },
  maskVariants: {
    dark: {
      cx: "50%",
      cy: "23%",
    },
    light: {
      cx: "100%",
      cy: "0%",
    },
    system: {
      cx: "50%",
      cy: "50%",
    },
  },
  linesVariants: {
    dark: {
      opacity: 0,
    },
    light: {
      opacity: 1,
    },
    system: {
      opacity: 1,
    },
  },
};

const MotionThemeIcon: FC<{
  /**
   * @deprecated use `theme` from `useTheme` instead
   */
  isDark?: boolean;
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
      variants={variants.svgVariants}
      animate={theme}>
      <mask id={`${id}-mask`}>
        <rect x="0" y="0" width="100%" height="100%" fill="white" />
        <motion.circle
          r="9"
          fill="black"
          variants={variants.maskVariants}
          animate={theme}
        />
      </mask>
      <motion.circle
        cx="12"
        cy="12"
        fill="currentColor"
        mask={`url(#${id}-mask)`}
        variants={variants.circleVariants}
        animate={theme}
      />
      <motion.g
        stroke="currentColor"
        variants={variants.linesVariants}
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

export const ThemeSelector: FC<Props> = ({
  variants = defaultThemeVariants,
}) => {
  const { theme = "system", setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <MotionThemeIcon theme={theme as Theme} variants={variants} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ThemeSelector;
export { MotionThemeIcon };
