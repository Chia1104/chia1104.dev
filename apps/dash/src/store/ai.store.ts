import { subscribeWithSelector } from "zustand/middleware";
import { persist } from "zustand/middleware";
import { createWithEqualityFn } from "zustand/traditional";
import type { StateCreator } from "zustand/vanilla";

import type { Modal } from "@chia/ai/types";
import {
  Provider,
  OpenAIModal,
  AnthropicModal,
  GoogleModal,
  DeepSeekModal,
} from "@chia/ai/types";

export type Workspace =
  | "feed-title"
  | "feed-description"
  | "feed-image"
  | "feed-slug"
  | "feed-content";

const DEFAULT_MODAL: Record<Workspace, Modal> = {
  "feed-title": {
    provider: Provider.OpenAI,
    id: OpenAIModal["gpt-4o-mini"],
  },
  "feed-description": {
    provider: Provider.OpenAI,
    id: OpenAIModal["gpt-4o-mini"],
  },
  "feed-image": {
    provider: Provider.OpenAI,
    id: OpenAIModal["gpt-4o-mini"],
  },
  "feed-slug": {
    provider: Provider.OpenAI,
    id: OpenAIModal["gpt-4o-mini"],
  },
  "feed-content": {
    provider: Provider.OpenAI,
    id: OpenAIModal["gpt-4o-mini"],
  },
};

const DEFAULT_OPTIONS: ModalOption[] = [
  {
    enabled: true,
    name: "Gemini 2.0 Flash",
    provider: Provider.Google,
    id: GoogleModal["gemini-2.0-flash"],
  },
  {
    enabled: true,
    name: "Claude 3.7 Sonnet",
    provider: Provider.Anthropic,
    id: AnthropicModal["claude-3-7-sonnet"],
  },
  {
    enabled: true,
    name: "Claude 3.5 Haiku",
    provider: Provider.Anthropic,
    id: AnthropicModal["claude-3-5-haiku"],
  },
  {
    enabled: true,
    name: "gpt 4o mini",
    provider: Provider.OpenAI,
    id: OpenAIModal["gpt-4o-mini"],
  },
  {
    enabled: true,
    name: "gpt 4o",
    provider: Provider.OpenAI,
    id: OpenAIModal["gpt-4o"],
  },
  {
    enabled: true,
    name: "gpt 4",
    provider: Provider.OpenAI,
    id: OpenAIModal["gpt-4"],
  },
  {
    enabled: true,
    name: "o3 mini",
    provider: Provider.OpenAI,
    id: OpenAIModal["o3-mini"],
  },
  {
    enabled: true,
    name: "o1 mini",
    provider: Provider.OpenAI,
    id: OpenAIModal["o1-mini"],
  },
  {
    enabled: true,
    name: "o1",
    provider: Provider.OpenAI,
    id: OpenAIModal.o1,
  },
  {
    enabled: true,
    name: "DeepSeek R1",
    provider: Provider.DeepSeek,
    id: DeepSeekModal["deepseek-r1"],
  },
];

type ModalOption = {
  enabled: boolean;
  name: string;
} & Modal;

export interface AIAction {
  setModal: (workspace: Workspace, modal: Modal) => void;
  getModal: (workspace: Workspace) => Modal;
}

export interface AIState {
  modal: Record<Workspace, Modal>;
  options: ModalOption[];
}

interface PersistState {
  modal: Record<Workspace, Modal>;
}

export type AIStore = AIState & AIAction;

const createStore: StateCreator<
  AIStore,
  [],
  [["zustand/subscribeWithSelector", never], ["zustand/persist", PersistState]]
> = subscribeWithSelector(
  persist(
    (set, get) => ({
      modal: DEFAULT_MODAL,
      options: DEFAULT_OPTIONS,
      setModal: (workspace, modal) =>
        set((state) => ({ modal: { ...state.modal, [workspace]: modal } })),
      getModal: (workspace) => get().modal[workspace],
    }),
    {
      name: "ai-modal",
      partialize: (state) => ({ modal: state.modal }),
    }
  )
);
export const useAIStore = createWithEqualityFn<AIStore>()(createStore);
