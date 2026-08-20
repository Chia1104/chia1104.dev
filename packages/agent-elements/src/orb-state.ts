import type { OrbState } from "thinking-orbs";

import type {
  AgentViewItem,
  ToolCallView,
} from "@chia/agent-runtime/wire/fold";

export type { OrbState };

/** Tools whose motion reads better than their tier's default. */
const BY_TOOL = {
  web_search: "searching",
  search_posts: "searching",
  fetch_url: "connecting",
} satisfies Record<string, OrbState>;

/** Tiers are an open string per kind; anything unknown falls back to `working`. */
const BY_TIER = {
  read: "working",
  draft: "weaving",
  commit: "shaping",
} satisfies Record<string, OrbState>;

const lookup = <TValue>(
  table: Record<string, TValue>,
  key: string
): TValue | undefined => (Object.hasOwn(table, key) ? table[key] : undefined);

export const orbStateOfTool = (tool: ToolCallView): OrbState =>
  tool.status === "awaiting_approval"
    ? "breathing"
    : (lookup<OrbState>(BY_TOOL, tool.toolName) ??
      lookup<OrbState>(BY_TIER, tool.tier) ??
      "working");

/** What the agent is doing right now at the tail of a reply, or null when nothing is live. */
export const orbStateOf = (
  items: readonly AgentViewItem[]
): OrbState | null => {
  const last = items.at(-1);
  if (!last) return null;
  if (last.kind === "tool") {
    return last.status === "running" || last.status === "awaiting_approval"
      ? orbStateOfTool(last)
      : null;
  }
  if (last.kind === "assistant" && last.streaming) {
    return last.text ? "composing" : "solving";
  }
  return null;
};
