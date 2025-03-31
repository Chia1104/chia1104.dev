import { subscribeWithSelector } from "zustand/middleware";
import { persist } from "zustand/middleware";
import { createWithEqualityFn } from "zustand/traditional";
import type { StateCreator } from "zustand/vanilla";

import type { Model } from "@chia/ai/types";
import {
  Provider,
  OpenAIModel,
  AnthropicModel,
  GoogleModel,
  DeepSeekModel,
} from "@chia/ai/types";

export type Workspace =
  | "feed-title"
  | "feed-description"
  | "feed-image"
  | "feed-slug"
  | "feed-content"
  | "chat";

const DEFAULT_MODAL: Record<Workspace, Model> = {
  "feed-title": {
    provider: Provider.OpenAI,
    id: OpenAIModel["gpt-4o-mini"],
  },
  "feed-description": {
    provider: Provider.OpenAI,
    id: OpenAIModel["gpt-4o-mini"],
  },
  "feed-image": {
    provider: Provider.OpenAI,
    id: OpenAIModel["gpt-4o-mini"],
  },
  "feed-slug": {
    provider: Provider.OpenAI,
    id: OpenAIModel["gpt-4o-mini"],
  },
  "feed-content": {
    provider: Provider.OpenAI,
    id: OpenAIModel["gpt-4o-mini"],
  },
  chat: {
    provider: Provider.OpenAI,
    id: OpenAIModel["gpt-4o-mini"],
  },
};

const DEFAULT_OPTIONS: ModalOption[] = [
  {
    enabled: true,
    name: "Gemini 2.0 Flash",
    provider: Provider.Google,
    id: GoogleModel["gemini-2.0-flash"],
    features: {
      image: true,
      search: true,
      pdf: true,
    },
  },
  {
    enabled: true,
    name: "Claude 3.7 Sonnet",
    provider: Provider.Anthropic,
    id: AnthropicModel["claude-3-7-sonnet"],
    features: {
      image: true,
      search: true,
      pdf: true,
    },
  },
  {
    enabled: true,
    name: "gpt 4o mini",
    provider: Provider.OpenAI,
    id: OpenAIModel["gpt-4o-mini"],
  },
  {
    enabled: true,
    name: "gpt 4o",
    provider: Provider.OpenAI,
    id: OpenAIModel["gpt-4o"],
    features: {
      image: true,
    },
  },
  {
    enabled: true,
    name: "o3 mini",
    provider: Provider.OpenAI,
    id: OpenAIModel["o3-mini"],
    features: {
      reasoning: true,
    },
  },
  {
    enabled: true,
    name: "o1 mini",
    provider: Provider.OpenAI,
    id: OpenAIModel["o1-mini"],
    features: {
      reasoning: true,
    },
  },
  {
    enabled: false,
    name: "o1",
    provider: Provider.OpenAI,
    id: OpenAIModel.o1,
    features: {
      reasoning: true,
    },
  },
  {
    enabled: false,
    name: "DeepSeek R1",
    provider: Provider.DeepSeek,
    id: DeepSeekModel["deepseek-r1"],
    features: {
      reasoning: true,
    },
  },
];

export interface ModelFeatures {
  reasoning?: boolean;
  image?: boolean;
  pdf?: boolean;
  search?: boolean;
}

type ModalOption = {
  enabled: boolean;
  name: string;
  description?: string;
  features?: ModelFeatures;
} & Model;

export interface AIAction {
  setModel: (workspace: Workspace, model: Model) => void;
  getModel: (workspace: Workspace) => Model;
}

export interface AIState {
  model: Record<Workspace, Model>;
  options: ModalOption[];
}

interface PersistState {
  model: Record<Workspace, Model>;
}

export type AIStore = AIState & AIAction;

const createStore: StateCreator<
  AIStore,
  [],
  [["zustand/subscribeWithSelector", never], ["zustand/persist", PersistState]]
> = subscribeWithSelector(
  persist(
    (set, get) => ({
      model: DEFAULT_MODAL,
      options: DEFAULT_OPTIONS,
      setModel: (workspace, model) =>
        set((state) => ({ model: { ...state.model, [workspace]: model } })),
      getModel: (workspace) => get().model[workspace],
    }),
    {
      name: "ai-modal",
      partialize: (state) => ({ model: state.model }),
    }
  )
);
export const useAIStore = createWithEqualityFn<AIStore>()(createStore);
