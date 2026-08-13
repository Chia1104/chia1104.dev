import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import { clampThinkingLevel } from "@earendil-works/pi-ai";
import type { Api, Model } from "@earendil-works/pi-ai";

import type { AgentSessionSettings } from "../types.ts";

/** Clamps persisted settings to the reasoning levels supported by the resolved Pi model. */
export const clampSessionThinkingLevel = (
  model: Model<Api>,
  settings: AgentSessionSettings
): ThinkingLevel => clampThinkingLevel(model, settings.thinkingLevel);
