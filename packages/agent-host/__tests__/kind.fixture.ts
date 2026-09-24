import { AgentProvider } from "@chia/agent-runtime/models";
import type { AgentSessionSettings } from "@chia/agent-runtime/types";
import type { CallerTier } from "@chia/auth/tier";
import type { DB } from "@chia/db/client";
import type { AgentSession } from "@chia/db/schema";
import type { ServiceContext } from "@chia/service-kit/context";
import { serviceContextOf } from "@chia/test/context";

import type { AgentKindCaller, AgentTurnContext } from "../src/kind";

export const db =
  /* SAFETY: every suite mocks the repositories it reaches, so nothing reads the handle. */ {} as DB;

export const callerOf = (
  tier: CallerTier,
  userId: string
): AgentKindCaller => ({
  tier,
  userId,
  adminId: "author",
  context: serviceContextOf<ServiceContext>({ db }),
});

export const sessionRowOf = (
  overrides: Partial<AgentSession> = {}
): AgentSession => ({
  id: "session-1",
  kind: "writing",
  userId: "author",
  title: null,
  providerId: null,
  modelId: null,
  thinkingLevel: "off",
  activeToolNames: null,
  autoApprove: [],
  runtimeConfig: {},
  configVersion: 1,
  leafEntryId: null,
  forkedFromSessionId: null,
  forkedFromEntryId: null,
  createdAt: new Date("2026-09-05T00:00:00Z"),
  updatedAt: new Date("2026-09-05T00:00:00Z"),
  deletedAt: null,
  ...overrides,
});

const settings: AgentSessionSettings = {
  providerId: AgentProvider.Gateway,
  modelId: "anthropic/claude-sonnet-5",
  thinkingLevel: "off",
  activeToolNames: null,
  autoApprove: [],
};

export const turnContextOf = <TState, TConfig extends object>(options: {
  state: TState;
  config: TConfig;
  row?: Partial<AgentSession>;
}): AgentTurnContext<TState, TConfig> => ({
  db,
  row: sessionRowOf(options.row),
  state: options.state,
  config: options.config,
  settings,
});
