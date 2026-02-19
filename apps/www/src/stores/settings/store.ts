"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { Theme } from "@chia/ui/theme";

export interface ThemeColors {
  // Shadcn UI Core
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  border: string;
  input: string;
  ring: string;

  // Shadcn UI Charts
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;

  // Shadcn UI Sidebar
  sidebar: string;
  sidebarForeground: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  sidebarBorder: string;
  sidebarRing: string;

  // HeroUI Semantic
  danger: string;
  dangerForeground: string;
  default: string;
  defaultForeground: string;
  fieldBackground: string;
  fieldForeground: string;
  fieldPlaceholder: string;
  focus: string;
  overlay: string;
  overlayForeground: string;
  scrollbar: string;
  segment: string;
  segmentForeground: string;
  separator: string;
  success: string;
  successForeground: string;
  surface: string;
  surfaceForeground: string;
  warning: string;
  warningForeground: string;
}

export interface ThemeLayout {
  radius: string;
  fieldRadius: string;
}

export interface ThemeTypography {
  fontSans: string;
}

export interface ThemeConfig {
  colors: Partial<ThemeColors>;
  layout: Partial<ThemeLayout>;
  typography: Partial<ThemeTypography>;
}

export interface ThemeState {
  light: ThemeConfig;
  dark: ThemeConfig;
}

export const COLOR_CSS_VAR_MAP: Record<keyof ThemeColors, string> = {
  background: "--background",
  foreground: "--foreground",
  card: "--card",
  cardForeground: "--card-foreground",
  popover: "--popover",
  popoverForeground: "--popover-foreground",
  primary: "--primary",
  primaryForeground: "--primary-foreground",
  secondary: "--secondary",
  secondaryForeground: "--secondary-foreground",
  muted: "--muted",
  mutedForeground: "--muted-foreground",
  accent: "--accent",
  accentForeground: "--accent-foreground",
  destructive: "--destructive",
  border: "--border",
  input: "--input",
  ring: "--ring",
  chart1: "--chart-1",
  chart2: "--chart-2",
  chart3: "--chart-3",
  chart4: "--chart-4",
  chart5: "--chart-5",
  sidebar: "--sidebar",
  sidebarForeground: "--sidebar-foreground",
  sidebarPrimary: "--sidebar-primary",
  sidebarPrimaryForeground: "--sidebar-primary-foreground",
  sidebarAccent: "--sidebar-accent",
  sidebarAccentForeground: "--sidebar-accent-foreground",
  sidebarBorder: "--sidebar-border",
  sidebarRing: "--sidebar-ring",
  danger: "--danger",
  dangerForeground: "--danger-foreground",
  default: "--default",
  defaultForeground: "--default-foreground",
  fieldBackground: "--field-background",
  fieldForeground: "--field-foreground",
  fieldPlaceholder: "--field-placeholder",
  focus: "--focus",
  overlay: "--overlay",
  overlayForeground: "--overlay-foreground",
  scrollbar: "--scrollbar",
  segment: "--segment",
  segmentForeground: "--segment-foreground",
  separator: "--separator",
  success: "--success",
  successForeground: "--success-foreground",
  surface: "--surface",
  surfaceForeground: "--surface-foreground",
  warning: "--warning",
  warningForeground: "--warning-foreground",
};

export const LAYOUT_CSS_VAR_MAP: Record<keyof ThemeLayout, string> = {
  radius: "--radius",
  fieldRadius: "--field-radius",
};

export const TYPOGRAPHY_CSS_VAR_MAP: Record<keyof ThemeTypography, string> = {
  fontSans: "--font-sans",
};

const emptyThemeConfig: ThemeConfig = {
  colors: {},
  layout: {},
  typography: {},
};

const emptyThemeState: ThemeState = {
  light: { ...emptyThemeConfig },
  dark: { ...emptyThemeConfig },
};

export interface SettingsState {
  aiEnabled: boolean;
  theme: ThemeState;
  backgroundEnabled: boolean;
  cursorEnabled: boolean;
}

export interface SettingsActions {
  setAiEnabled: (enabled: boolean) => void;
  setThemeConfig: (
    mode: typeof Theme.DARK | typeof Theme.LIGHT,
    config: Partial<ThemeConfig>
  ) => void;
  setThemeColor: (
    mode: typeof Theme.DARK | typeof Theme.LIGHT,
    colors: Partial<ThemeColors>
  ) => void;
  setThemeLayout: (
    mode: typeof Theme.DARK | typeof Theme.LIGHT,
    layout: Partial<ThemeLayout>
  ) => void;
  setThemeTypography: (
    mode: typeof Theme.DARK | typeof Theme.LIGHT,
    typography: Partial<ThemeTypography>
  ) => void;
  resetTheme: (mode?: typeof Theme.DARK | typeof Theme.LIGHT) => void;
  setBackgroundEnabled: (enabled: boolean) => void;
  setCursorEnabled: (enabled: boolean) => void;
}

export type SettingsStore = SettingsState & SettingsActions;

const defaultState: SettingsState = {
  aiEnabled: false,
  theme: emptyThemeState,
  backgroundEnabled: true,
  cursorEnabled: true,
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...defaultState,

      setAiEnabled: (enabled) => set({ aiEnabled: enabled }),
      setBackgroundEnabled: (enabled) => set({ backgroundEnabled: enabled }),
      setCursorEnabled: (enabled) => set({ cursorEnabled: enabled }),
      setThemeConfig: (mode, config) =>
        set((state) => ({
          theme: {
            ...state.theme,
            [mode]: {
              colors: {
                ...state.theme[mode].colors,
                ...(config.colors ?? {}),
              },
              layout: {
                ...state.theme[mode].layout,
                ...(config.layout ?? {}),
              },
              typography: {
                ...state.theme[mode].typography,
                ...(config.typography ?? {}),
              },
            },
          },
        })),

      setThemeColor: (mode, colors) =>
        set((state) => ({
          theme: {
            ...state.theme,
            [mode]: {
              ...state.theme[mode],
              colors: {
                ...state.theme[mode].colors,
                ...colors,
              },
            },
          },
        })),

      setThemeLayout: (mode, layout) =>
        set((state) => ({
          theme: {
            ...state.theme,
            [mode]: {
              ...state.theme[mode],
              layout: {
                ...state.theme[mode].layout,
                ...layout,
              },
            },
          },
        })),

      setThemeTypography: (mode, typography) =>
        set((state) => ({
          theme: {
            ...state.theme,
            [mode]: {
              ...state.theme[mode],
              typography: {
                ...state.theme[mode].typography,
                ...typography,
              },
            },
          },
        })),

      resetTheme: (mode) => {
        if (mode) {
          set((state) => ({
            theme: {
              ...state.theme,
              [mode]: {
                colors: {},
                layout: {},
                typography: {},
              },
            },
          }));
        } else {
          set({
            theme: {
              light: { colors: {}, layout: {}, typography: {} },
              dark: { colors: {}, layout: {}, typography: {} },
            },
          });
        }
      },
    }),
    {
      name: "SETTINGS_STORE",
      partialize: (state) => ({
        aiEnabled: state.aiEnabled,
        theme: state.theme,
        backgroundEnabled: state.backgroundEnabled,
        cursorEnabled: state.cursorEnabled,
      }),
    }
  )
);
