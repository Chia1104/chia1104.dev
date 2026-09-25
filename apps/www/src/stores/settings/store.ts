"use client";

import * as z from "zod";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { Theme } from "@chia/ui/utils/use-theme";

export interface ThemeColors {
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

  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;

  sidebar: string;
  sidebarForeground: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  sidebarBorder: string;
  sidebarRing: string;

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
  [Theme.Light]: ThemeConfig;
  [Theme.Dark]: ThemeConfig;
}

export const COLOR_CSS_VAR_MAP = {
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
} satisfies Record<keyof ThemeColors, string>;

export const LAYOUT_CSS_VAR_MAP = {
  radius: "--radius",
  fieldRadius: "--field-radius",
} satisfies Record<keyof ThemeLayout, string>;

export const TYPOGRAPHY_CSS_VAR_MAP = {
  fontSans: "--font-sans",
} satisfies Record<keyof ThemeTypography, string>;

const emptyThemeConfig: ThemeConfig = {
  colors: {},
  layout: {},
  typography: {},
};

const emptyThemeState: ThemeState = {
  [Theme.Light]: { ...emptyThemeConfig },
  [Theme.Dark]: { ...emptyThemeConfig },
};

export interface SettingsState {
  aiEnabled: boolean;
  /** The public agent conversation to reopen; validated against the server's list on mount. */
  agentSessionId: string | null;
  theme: ThemeState;
}

const themeConfigSchema = z.object({
  colors: z.record(z.string(), z.string()),
  layout: z.record(z.string(), z.string()),
  typography: z.record(z.string(), z.string()),
});

/** What `partialize` writes; storage that does not parse restores the defaults. */
const persistedSettingsSchema = z
  .object({
    aiEnabled: z.boolean(),
    agentSessionId: z.string().nullable(),
    theme: z.object({
      [Theme.Light]: themeConfigSchema,
      [Theme.Dark]: themeConfigSchema,
    }),
  })
  .partial();

export interface SettingsActions {
  setAiEnabled: (enabled: boolean) => void;
  setAgentSessionId: (sessionId: string | null) => void;
  setThemeConfig: (
    mode: typeof Theme.Dark | typeof Theme.Light,
    config: Partial<ThemeConfig>
  ) => void;
  setThemeColor: (
    mode: typeof Theme.Dark | typeof Theme.Light,
    colors: Partial<ThemeColors>
  ) => void;
  setThemeLayout: (
    mode: typeof Theme.Dark | typeof Theme.Light,
    layout: Partial<ThemeLayout>
  ) => void;
  setThemeTypography: (
    mode: typeof Theme.Dark | typeof Theme.Light,
    typography: Partial<ThemeTypography>
  ) => void;
  resetTheme: (mode?: typeof Theme.Dark | typeof Theme.Light) => void;
}

export type SettingsStore = SettingsState & SettingsActions;

const defaultState: SettingsState = {
  aiEnabled: true,
  agentSessionId: null,
  theme: emptyThemeState,
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...defaultState,

      setAiEnabled: (enabled) => set({ aiEnabled: enabled }),
      setAgentSessionId: (sessionId) => set({ agentSessionId: sessionId }),
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
              [Theme.Light]: { colors: {}, layout: {}, typography: {} },
              [Theme.Dark]: { colors: {}, layout: {}, typography: {} },
            },
          });
        }
      },
    }),
    {
      name: "SETTINGS_STORE",
      /** 1: AI features became opt-out; every earlier visitor had `false` persisted by default. */
      version: 1,
      migrate: (persisted, version) => {
        const state = persistedSettingsSchema.safeParse(persisted).data ?? {};
        return version < 1 ? { ...state, aiEnabled: true } : state;
      },
      merge: (persisted, current) => ({
        ...current,
        ...persistedSettingsSchema.safeParse(persisted).data,
      }),
      partialize: (state) => ({
        aiEnabled: state.aiEnabled,
        agentSessionId: state.agentSessionId,
        theme: state.theme,
      }),
    }
  )
);
