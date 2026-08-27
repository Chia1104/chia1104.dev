"use client";

import type { ReactNode } from "react";
import { createContext, use, useMemo } from "react";

import type { AgentLabels } from "./labels.ts";
import { defaultAgentLabels, mergeLabels } from "./labels.ts";

/**
 * The label catalog as React context, on its own so an element that only needs strings —
 * the model picker, the thinking slider — can be mounted without a session.
 * `AgentSessionProvider` mounts one for its subtree; a host that renders such an element
 * elsewhere mounts one itself. With no provider at all the `en-US` catalog applies, so an
 * element is never blocked on wiring for what is, after all, cosmetic.
 */

const AgentLabelsContext = createContext<AgentLabels>(defaultAgentLabels);

export interface AgentLabelsProviderProps {
  /** The catalog for the host's locale (`@chia/i18n/agent-elements/<locale>.json`), or overrides. */
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
