import type { AgentThinkingLevel } from "./types.ts";

/** Every user-visible string, so a host can localise without forking the elements. */
export interface AgentLabels {
  emptyTitle: string;
  emptyDescription: string;
  composerPlaceholder: string;
  composerPlaceholderRunning: string;
  composerPlaceholderApproval: string;
  composerHint: string;
  statusReady: string;
  statusStreaming: string;
  statusAwaitingApproval: string;
  send: string;
  stop: string;
  thinking: string;
  thought: string;
  toolRunning: string;
  toolDone: string;
  toolFailed: string;
  toolAwaitingApproval: string;
  arguments: string;
  result: string;
  approvalTag: string;
  approvalTitle: (toolLabel: string) => string;
  approvalHint: string;
  approve: string;
  reject: string;
  approved: string;
  rejected: string;
  approvedNote: string;
  rejectedNote: string;
  compacted: string;
  modelPicker: string;
  thinkingLevel: string;
  thinkingLevelNames: Record<AgentThinkingLevel, string>;
  needsApiKey: string;
  newSession: string;
  moreSessions: string;
  searchSessions: string;
  noSessions: string;
  untitledSession: string;
  dismiss: string;
}

export const defaultAgentLabels: AgentLabels = {
  emptyTitle: "What do you need?",
  emptyDescription:
    "Ask a question. Anything that writes outside this conversation asks you first.",
  composerPlaceholder: "Ask anything…",
  composerPlaceholderRunning: "The agent is working…",
  composerPlaceholderApproval: "Approve or reject the pending tool first.",
  composerHint: "Enter to send · Shift+Enter for a new line",
  statusReady: "Ready",
  statusStreaming: "Streaming",
  statusAwaitingApproval: "Needs approval",
  send: "Send",
  stop: "Stop",
  thinking: "Thinking",
  thought: "Thought",
  toolRunning: "Running…",
  toolDone: "Done",
  toolFailed: "Failed",
  toolAwaitingApproval: "Waiting for approval",
  arguments: "Arguments",
  result: "Result",
  approvalTag: "Approval needed",
  approvalTitle: (toolLabel) => `Allow ${toolLabel}?`,
  approvalHint: "This tool writes outside the conversation.",
  approve: "Allow",
  reject: "Reject",
  approved: "Allowed",
  rejected: "Rejected",
  approvedNote: "Approved by you",
  rejectedNote: "Nothing was executed",
  compacted: "Conversation compacted",
  modelPicker: "Model",
  thinkingLevel: "Thinking",
  thinkingLevelNames: {
    off: "Off",
    minimal: "Minimal",
    low: "Low",
    medium: "Medium",
    high: "High",
    xhigh: "Extra high",
    max: "Max",
  },
  needsApiKey: "needs API key",
  newSession: "New chat",
  moreSessions: "More",
  searchSessions: "Search conversations",
  noSessions: "No matching conversations",
  untitledSession: "Untitled",
  dismiss: "Dismiss",
};
