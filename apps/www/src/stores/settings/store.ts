"use client";

import * as z from "zod";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { HEXA_PATTERN, PaletteMode, PaletteToken } from "@/libs/palette";
import type { Palette } from "@/libs/palette";

import { SETTINGS_STORAGE_KEY } from "./storage-key";

export interface SettingsState {
  aiEnabled: boolean;
  /** The public agent conversation to reopen; validated against the server's list on mount. */
  agentSessionId: string | null;
  /** Reader overrides of the theme's colours, one set per mode. */
  palette: Palette;
}

/** A palette that does not parse is dropped on its own, keeping the rest of the settings. */
const modePaletteSchema = z
  .partialRecord(z.enum(PaletteToken), z.string().regex(HEXA_PATTERN))
  .catch({});

/** What `partialize` writes; storage that does not parse restores the defaults. */
const persistedSettingsSchema = z
  .object({
    aiEnabled: z.boolean(),
    agentSessionId: z.string().nullable(),
    palette: z.object({
      [PaletteMode.Light]: modePaletteSchema,
      [PaletteMode.Dark]: modePaletteSchema,
    }),
  })
  .partial();

export interface SettingsActions {
  setAiEnabled: (enabled: boolean) => void;
  setAgentSessionId: (sessionId: string | null) => void;
  /** `null` drops the override so the token follows the theme again. */
  setPaletteColor: (
    mode: PaletteMode,
    token: PaletteToken,
    color: string | null
  ) => void;
  resetPalette: (mode: PaletteMode) => void;
}

export type SettingsStore = SettingsState & SettingsActions;

const defaultState: SettingsState = {
  aiEnabled: true,
  agentSessionId: null,
  palette: {
    [PaletteMode.Light]: {},
    [PaletteMode.Dark]: {},
  },
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...defaultState,

      setAiEnabled: (enabled) => set({ aiEnabled: enabled }),
      setAgentSessionId: (sessionId) => set({ agentSessionId: sessionId }),
      setPaletteColor: (mode, token, color) =>
        set((state) => {
          const { [token]: _previous, ...rest } = state.palette[mode];
          return {
            palette: {
              ...state.palette,
              [mode]: color ? { ...rest, [token]: color } : rest,
            },
          };
        }),
      resetPalette: (mode) =>
        set((state) => ({ palette: { ...state.palette, [mode]: {} } })),
    }),
    {
      name: SETTINGS_STORAGE_KEY,
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
        palette: state.palette,
      }),
    }
  )
);
