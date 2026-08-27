"use client";

import { useCallback } from "react";

import { Chip } from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";
import * as z from "zod";

import { ModelPicker } from "@chia/agent-elements/model-picker";
import { providerLabelOf } from "@chia/agent-elements/provider-icons";

import { orpc } from "@/libs/orpc/client";
import type { RouterOutputs } from "@/libs/orpc/types";

/**
 * Pieces both the kind and the task cards share: the model select with its "code default"
 * row, the override chip, and the invalidation every write ends with.
 */

export type AgentModelInfo =
  RouterOutputs["agent"]["admin"]["tasks"]["models"][number];
/** Mirrors the contract's `agentModelRefSchema`; the form schemas compose it. */
export const modelRefSchema = z.object({
  providerId: z.string().min(1),
  modelId: z.string().min(1),
});

export type ModelRef = z.infer<typeof modelRefSchema>;

export const modelLabel = (
  ref: ModelRef,
  models?: readonly AgentModelInfo[]
) => {
  const known = models?.find(
    (m) => m.providerId === ref.providerId && m.modelId === ref.modelId
  );
  const provider = providerLabelOf(ref.providerId) ?? ref.providerId;
  return `${known?.name ?? ref.modelId} · ${provider}`;
};

export interface ModelSelectProps {
  /** What "Default" resolves to; shown in the row so the choice is never blind. */
  defaultLabel: string;
  models: readonly AgentModelInfo[] | undefined;
  value: ModelRef | null;
  onChange: (ref: ModelRef | null) => void;
  isDisabled?: boolean;
}

/** Providers the house account serves first; the rest follow alphabetically. */
const PROVIDER_ORDER = ["vercel-ai-gateway", "anthropic", "openai"];

/**
 * The agent elements' model picker with a "Default" row on top: a pair, or `null` for the
 * code default. Models a caller-supplied key would be needed for are listed but disabled, so
 * the operator sees the option exists and why it is not available.
 */
export const ModelSelect = ({
  defaultLabel,
  isDisabled,
  models,
  onChange,
  value,
}: ModelSelectProps) => (
  <ModelPicker
    fallback={{ label: `Default — ${defaultLabel}` }}
    isDisabled={isDisabled}
    models={models}
    onChange={onChange}
    providerOrder={PROVIDER_ORDER}
    value={value}
  />
);

export const OverriddenChip = ({ isOverridden }: { isOverridden: boolean }) =>
  isOverridden ? (
    <Chip color="warning" size="sm" variant="soft">
      <Chip.Label className="text-xs">overridden</Chip.Label>
    </Chip>
  ) : (
    <Chip size="sm" variant="soft">
      <Chip.Label className="text-xs">code default</Chip.Label>
    </Chip>
  );

export const formatDate = (value: number) =>
  new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

export const useInvalidateAgentAdmin = () => {
  const queryClient = useQueryClient();
  return useCallback(
    () =>
      void queryClient.invalidateQueries({ queryKey: orpc.agent.admin.key() }),
    [queryClient]
  );
};
