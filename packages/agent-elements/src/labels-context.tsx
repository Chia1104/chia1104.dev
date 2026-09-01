"use client";

import type { ReactNode } from "react";
import { createContext, use, useMemo } from "react";

import type { AgentLabels } from "./labels.ts";
import { defaultAgentLabels, mergeLabels } from "./labels.ts";

/**
 * Label catalog as its own context so elements that only need strings can mount without a
 * session. `AgentSessionProvider` mounts one for its subtree; a host rendering those elements
 * elsewhere mounts one itself. With no provider the `en-US` catalog applies.
 */

const AgentLabelsContext = createContext<AgentLabels>(defaultAgentLabels);

export interface AgentLabelsProviderProps {
  /** Host locale catalog (`@chia/i18n/agent-elements/<locale>.json`), or overrides. */
  labels?: Partial<AgentLabels>;
  children: ReactNode;
}

export const AgentLabelsProvider = ({
  children,
  labels,
}: AgentLabelsProviderProps) => {
  const value = useMemo(() => mergeLabels(labels), [labels]);
  return <AgentLabelsContext value={value}>{children}</AgentLabelsContext>;
};

export const useAgentLabels = (): AgentLabels => use(AgentLabelsContext);
