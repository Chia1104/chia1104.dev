import { AgentHarness } from "@earendil-works/pi-agent-core";
import type { Session } from "@earendil-works/pi-agent-core";
import type { Api, Model, Models } from "@earendil-works/pi-ai";

import type { AgentSessionSettings } from "../types.ts";
import type {
  AgentCompactionResult,
  AgentNavigationOptions,
  AgentNavigationResult,
} from "../types.ts";

import { clampSessionThinkingLevel } from "./settings.ts";

export interface PiSessionOperationOptions {
  session: Session;
  settings: AgentSessionSettings;
  model: Model<Api>;
  models: Models;
}

const createMaintenanceHarness = ({
  session,
  settings,
  model,
  models,
}: PiSessionOperationOptions): AgentHarness =>
  new AgentHarness({
    session,
    models,
    model,
    tools: [],
    thinkingLevel: clampSessionThinkingLevel(model, settings),
    systemPrompt: "",
  } as never) as AgentHarness;

/** Runs Pi's native compaction without constructing writing tools or turn subscriptions. */
export const compactPiSession = async (
  options: PiSessionOperationOptions,
  customInstructions?: string
): Promise<AgentCompactionResult> => {
  const result =
    await createMaintenanceHarness(options).compact(customInstructions);
  return { summary: result.summary, tokensBefore: result.tokensBefore };
};

/** Rewinds a Pi session tree without constructing a turn-capable wrapper. */
export const navigatePiSession = async (
  options: PiSessionOperationOptions,
  entryId: string,
  navigationOptions: AgentNavigationOptions
): Promise<AgentNavigationResult> => {
  const result = await createMaintenanceHarness(options).navigateTree(
    entryId,
    navigationOptions
  );
  return { cancelled: result.cancelled };
};
